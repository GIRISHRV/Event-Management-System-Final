// src/app/api/admin/evaluate/route.ts
//
// Evaluation pipeline for paper metrics.
//
// KEY FIX — global temporal cutoff:
//   All bookings before the 70th-percentile timestamp = training data
//   All bookings after = ground truth (test set)
//   Ground truth items that also appear in a user's training set are removed
//   so the evaluator never rewards recommendations of already-seen items.
//
// This eliminates the train/test leakage that was inflating NDCG to ~0.77.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ndcgAtK, precisionAtK, mae, rmse, mape } from "@/lib/algorithms/shared/evaluation";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (user.app_metadata?.role !== "admin") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!profile || profile.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // ── Pass 1: Collect predictions first ───────────────────────────────────────
    // By fetching predictions before ground truth, we only evaluate users
    // that simulate actually ran for. This guarantees the two sets match.
    const { data: algoResults } = await supabase
      .from("algorithm_results")
      .select("user_id, output_data, created_at, input_data")
      .eq("algorithm_type", "xsimgcl")
      .order("created_at", { ascending: false });

    type PredictionRow = { user_id: string; output_data: { recommendations?: { eventId: string }[]; coldStart?: boolean }; input_data?: { interactionCount?: number }; created_at: string };
    const predictions = new Map<string, PredictionRow>();
    for (const row of algoResults || []) {
      if (!predictions.has(row.user_id)) {
        predictions.set(row.user_id, row as unknown as PredictionRow);
      }
    }

    console.log(`[EVAL] Found ${algoResults?.length || 0} xsimgcl results → ${predictions.size} unique users`);

    // ── Pass 2: Build ground truth — only for users with predictions ──────────
    //
    // Global 70th-percentile cutoff splits all bookings into train/test.
    // Ground truth = test-window bookings NOT already in the user's train set.
    // We only compute this for users who have saved predictions, so the
    // two populations are guaranteed to match.

    const { data: bookings } = await supabase
      .from("bookings")
      .select("user_id, event_id, created_at")
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    console.log(`[EVAL] Fetched ${bookings?.length || 0} confirmed bookings`);

    const allBookings = bookings || [];

    // Global 70th-percentile cutoff
    const allTimes = allBookings
      .map(b => new Date(b.created_at).getTime())
      .sort((a, b) => a - b);

    const cutoffTime = allTimes.length > 0
      ? allTimes[Math.floor(allTimes.length * 0.7)]
      : Date.now();

    console.log(`[EVAL] Global cutoff: ${new Date(cutoffTime).toISOString()} (${allTimes.length} bookings)`);

    const userTrainEvents = new Map<string, Set<string>>();
    const userTestEvents = new Map<string, string[]>();

    for (const b of allBookings) {
      // Only process users that have predictions — skip everyone else
      if (!predictions.has(b.user_id)) continue;

      const t = new Date(b.created_at).getTime();
      if (t <= cutoffTime) {
        if (!userTrainEvents.has(b.user_id)) userTrainEvents.set(b.user_id, new Set());
        userTrainEvents.get(b.user_id)!.add(b.event_id);
      } else {
        if (!userTestEvents.has(b.user_id)) userTestEvents.set(b.user_id, []);
        userTestEvents.get(b.user_id)!.push(b.event_id);
      }
    }

    // Ground truth = test events not already seen in training (anti-leakage)
    const groundTruth = new Map<string, string[]>();
    for (const [userId, testEvents] of userTestEvents.entries()) {
      const trainSet = userTrainEvents.get(userId) ?? new Set<string>();
      const cleanGt = testEvents.filter(eid => !trainSet.has(eid));
      if (cleanGt.length > 0) {
        groundTruth.set(userId, cleanGt);
      }
    }

    console.log(`[EVAL] Ground truth for ${groundTruth.size} users (from ${predictions.size} with predictions)`);

    // ── Pass 3: Compute metrics ───────────────────────────────────────────────
    const { data: candidateEvents } = await supabase.from("events").select("id");
    const allEventIds = (candidateEvents || []).map(e => e.id);

    let sumNdcg = 0;
    let sumPrec = 0;
    let sumNdcgCold = 0;
    let coldCount = 0;
    let sumNdcgBase = 0;
    let sumPrecBase = 0;
    let sumNdcgColdBase = 0;
    let evalCount = 0;

    // ── Debug: log first 3 users to diagnose zero NDCG ─────────────────────────
    let debugCount = 0;

    for (const [userId, gt] of groundTruth.entries()) {
      const predRow = predictions.get(userId);
      if (!predRow || !predRow.output_data?.recommendations) continue;

      // Do NOT filter recs by trainSet here.
      // Anti-leakage is already handled at ground truth construction:
      // cleanGt already excludes test events that were also in training.
      // Filtering recs by trainSet here incorrectly removes legitimate hits
      // when a ground truth event also appears in the user's training history.
      const recs = predRow.output_data.recommendations
        .map((r: { eventId: string }) => r.eventId);

      // Debug: log first 3 users
      if (debugCount < 3) {
        const hits = recs.filter((id: string) => gt.includes(id));
        console.log(`[EVAL-DEBUG] User ${userId.slice(0, 8)}: gt=${gt.map((id: string) => id.slice(0, 8)).join(',')} | top3recs=${recs.slice(0, 3).map((id: string) => id.slice(0, 8)).join(',')} | hits=${hits.length}`);
        debugCount++;
      }

      const isColdStart =
        predRow.output_data?.coldStart ?? ((predRow.input_data?.interactionCount ?? 0) < 3);

      const ndcg = ndcgAtK(recs, gt, 10);
      const prec = precisionAtK(recs, gt, 10);

      // Theoretical random baseline
      const hitProbability = gt.length / Math.max(allEventIds.length, 1);
      const precBase = hitProbability;

      let idcg = 0;
      for (let i = 0; i < Math.min(gt.length, 10); i++) {
        idcg += 1 / Math.log2(i + 2);
      }
      let expectedDcg = 0;
      for (let i = 0; i < 10; i++) {
        expectedDcg += hitProbability / Math.log2(i + 2);
      }
      const ndcgBase = idcg > 0 ? expectedDcg / idcg : 0;

      sumNdcg += ndcg;
      sumPrec += prec;
      sumNdcgBase += ndcgBase;
      sumPrecBase += precBase;

      if (isColdStart) {
        sumNdcgCold += ndcg;
        sumNdcgColdBase += ndcgBase;
        coldCount++;
      }

      evalCount++;
    }

    const metrics = {
      usersEvaluated: evalCount,
      meanGroundTruthSize:
        groundTruth.size > 0
          ? parseFloat(
            (
              [...groundTruth.values()].reduce((s, gt) => s + gt.length, 0) /
              groundTruth.size
            ).toFixed(2)
          )
          : 0,
      meanNdcg10: evalCount > 0 ? parseFloat((sumNdcg / evalCount).toFixed(4)) : 0,
      meanPrecision10: evalCount > 0 ? parseFloat((sumPrec / evalCount).toFixed(4)) : 0,
      meanNdcg10ColdStart:
        coldCount > 0 ? parseFloat((sumNdcgCold / coldCount).toFixed(4)) : 0,
      baselineNdcg10:
        evalCount > 0 ? parseFloat((sumNdcgBase / evalCount).toFixed(4)) : 0,
      baselinePrecision10:
        evalCount > 0 ? parseFloat((sumPrecBase / evalCount).toFixed(4)) : 0,
      baselineNdcg10ColdStart:
        coldCount > 0 ? parseFloat((sumNdcgColdBase / coldCount).toFixed(4)) : 0,
      // Evaluation methodology note for paper
      evaluationMethod: "global_temporal_cutoff_70pct",
      cutoffTimestamp: new Date(cutoffTime).toISOString(),
      forecasting: { mae: 0, rmse: 0, mape: 0, baselineMae: 0, baselineRmse: 0 },
    };

    // ── Forecasting metrics ───────────────────────────────────────────────────
    try {
      const { data: allForecasts } = await supabase
        .from("attendance_forecasts")
        .select("*");

      if (allForecasts && allForecasts.length > 0) {
        const { data: allBookingsForForecast } = await supabase
          .from("bookings")
          .select("event_id, created_at")
          .eq("status", "confirmed");

        const bookingsByEventDate = new Map<string, number>();
        for (const b of allBookingsForForecast || []) {
          const date = new Date(b.created_at).toISOString().split("T")[0];
          const key = `${b.event_id}_${date}`;
          bookingsByEventDate.set(key, (bookingsByEventDate.get(key) || 0) + 1);
        }

        const actuals: number[] = [];
        const preds: number[] = [];
        const basePreds: number[] = [];

        for (const f of allForecasts) {
          if (!f.forecast_date || f.predicted_attendance == null) continue;
          const targetDate = new Date(f.forecast_date).toISOString().split("T")[0];
          const actual = bookingsByEventDate.get(`${f.event_id}_${targetDate}`) || 0;

          actuals.push(actual);
          preds.push(f.predicted_attendance);

          // Naive baseline: what was booked 7 days before the forecast date
          const pastDate = new Date(
            new Date(f.forecast_date).getTime() - 7 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split("T")[0];
          basePreds.push(bookingsByEventDate.get(`${f.event_id}_${pastDate}`) || 0);
        }

        if (actuals.length > 0) {
          metrics.forecasting.mae = parseFloat(mae(actuals, preds).toFixed(4));
          metrics.forecasting.rmse = parseFloat(rmse(actuals, preds).toFixed(4));
          metrics.forecasting.mape = parseFloat(mape(actuals, preds).toFixed(4));
          metrics.forecasting.baselineMae = parseFloat(mae(actuals, basePreds).toFixed(4));
          metrics.forecasting.baselineRmse = parseFloat(rmse(actuals, basePreds).toFixed(4));
        }
      }
    } catch (e) {
      console.warn("[EVAL] Forecasting metrics skipped:", e);
    }

    // ── Persist result ────────────────────────────────────────────────────────
    await supabase.from("algorithm_results").insert({
      algorithm_type: "evaluation-run",
      input_data: { cutoffTimestamp: new Date(cutoffTime).toISOString() },
      output_data: metrics,
      version: "1.0.0",
    });

    return NextResponse.json({ success: true, metrics });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}