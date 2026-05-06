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
import { ndcgAtK, precisionAtK, mrrAtK, hitRateAtK, mae, rmse, mape } from "@/lib/algorithms/shared/evaluation";

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

    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { global: { headers: { "ngrok-skip-browser-warning": "true" } } });

    // ── Pass 1: Collect predictions first ───────────────────────────────────────
    // By fetching predictions before ground truth, we only evaluate users
    // that simulate actually ran for. This guarantees the two sets match.
    const { data: algoResults } = await adminSupabase
      .from("algorithm_results")
      .select("user_id, algorithm_type, output_data, created_at, input_data")  // ← add algorithm_type
      .in("algorithm_type", ["xsimgcl", "gnn-cf"])
      .order("created_at", { ascending: false });

    type PredictionRow = { user_id: string; algorithm_type: string; output_data: { recommendations?: { eventId: string }[]; coldStart?: boolean }; input_data?: { interactionCount?: number }; created_at: string };
    const xsimgclPredictions = new Map<string, PredictionRow>();
    const gnnCfPredictions = new Map<string, PredictionRow>();

    for (const row of (algoResults || []) as unknown as PredictionRow[]) {
      if (row.algorithm_type === "xsimgcl" && !xsimgclPredictions.has(row.user_id)) {
        xsimgclPredictions.set(row.user_id, row);
      } else if (row.algorithm_type === "gnn-cf" && !gnnCfPredictions.has(row.user_id)) {
        gnnCfPredictions.set(row.user_id, row);
      }
    }

    console.log(`[EVAL] Found ${algoResults?.length || 0} results → ${xsimgclPredictions.size} xsimgcl users, ${gnnCfPredictions.size} gnn-cf users`);

    // ── Pass 2: Build ground truth — only for users with predictions ──────────
    //
    // Global 70th-percentile cutoff splits all bookings into train/test.
    // Ground truth = test-window bookings NOT already in the user's train set.
    // We only compute this for users who have saved predictions, so the
    // two populations are guaranteed to match.

    const { data: bookings } = await adminSupabase
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
      // Only process users that have some prediction
      if (!xsimgclPredictions.has(b.user_id) && !gnnCfPredictions.has(b.user_id)) continue;

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

    console.log(`[EVAL] Ground truth for ${groundTruth.size} users (from users with predictions)`);

    // ── Pass 3: Compute metrics ───────────────────────────────────────────────
    const { data: candidateEvents } = await supabase.from("events").select("id");
    const allEventIds = (candidateEvents || []).map(e => e.id);

    const calculateMetrics = (predsMap: Map<string, PredictionRow>) => {
      let sumNdcg = 0;
      let sumPrec = 0;
      let sumMrr = 0;
      let sumHitRate = 0;
      let sumNdcgBase = 0;
      let sumPrecBase = 0;
      let count = 0;

      for (const [userId, gt] of groundTruth.entries()) {
        const predRow = predsMap.get(userId);
        if (!predRow || !predRow.output_data?.recommendations) continue;

        const recs = predRow.output_data.recommendations.map((r: { eventId: string }) => r.eventId);
        const ndcg = ndcgAtK(recs, gt, 10);
        const prec = precisionAtK(recs, gt, 10);
        const mrr = mrrAtK(recs, gt, 10);
        const hr = hitRateAtK(recs, gt, 10);

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
        sumMrr += mrr;
        sumHitRate += hr;
        sumNdcgBase += ndcgBase;
        sumPrecBase += precBase;
        count++;
      }

      return {
        count,
        ndcg: count > 0 ? parseFloat((sumNdcg / count).toFixed(4)) : 0,
        precision: count > 0 ? parseFloat((sumPrec / count).toFixed(4)) : 0,
        mrr: count > 0 ? parseFloat((sumMrr / count).toFixed(4)) : 0,
        hitRate: count > 0 ? parseFloat((sumHitRate / count).toFixed(4)) : 0,
        baselineNdcg: count > 0 ? parseFloat((sumNdcgBase / count).toFixed(4)) : 0,
        baselinePrecision: count > 0 ? parseFloat((sumPrecBase / count).toFixed(4)) : 0,
      };
    };

    const xsimgclMetrics = calculateMetrics(xsimgclPredictions);
    const gnnCfMetrics = calculateMetrics(gnnCfPredictions);

    const metrics = {
      usersEvaluated: xsimgclMetrics.count + gnnCfMetrics.count,
      meanGroundTruthSize:
        groundTruth.size > 0
          ? parseFloat(
            ([...groundTruth.values()].reduce((s, gt) => s + gt.length, 0) / groundTruth.size).toFixed(2)
          )
          : 0,

      // XSimGCL (Warm)
      xsimgcl: xsimgclMetrics,

      // GNN-CF (Cold Start)
      gnncf: gnnCfMetrics,

      // Blended (for backwards compat)
      meanNdcg10: parseFloat(((xsimgclMetrics.ndcg * xsimgclMetrics.count + gnnCfMetrics.ndcg * gnnCfMetrics.count) / Math.max(1, xsimgclMetrics.count + gnnCfMetrics.count)).toFixed(4)),
      meanPrecision10: parseFloat(((xsimgclMetrics.precision * xsimgclMetrics.count + gnnCfMetrics.precision * gnnCfMetrics.count) / Math.max(1, xsimgclMetrics.count + gnnCfMetrics.count)).toFixed(4)),
      meanMrr10: parseFloat(((xsimgclMetrics.mrr * xsimgclMetrics.count + gnnCfMetrics.mrr * gnnCfMetrics.count) / Math.max(1, xsimgclMetrics.count + gnnCfMetrics.count)).toFixed(4)),
      meanHitRate10: parseFloat(((xsimgclMetrics.hitRate * xsimgclMetrics.count + gnnCfMetrics.hitRate * gnnCfMetrics.count) / Math.max(1, xsimgclMetrics.count + gnnCfMetrics.count)).toFixed(4)),
      baselineNdcg10: parseFloat(((xsimgclMetrics.baselineNdcg * xsimgclMetrics.count + gnnCfMetrics.baselineNdcg * gnnCfMetrics.count) / Math.max(1, xsimgclMetrics.count + gnnCfMetrics.count)).toFixed(4)),
      baselinePrecision10: parseFloat(((xsimgclMetrics.baselinePrecision * xsimgclMetrics.count + gnnCfMetrics.baselinePrecision * gnnCfMetrics.count) / Math.max(1, xsimgclMetrics.count + gnnCfMetrics.count)).toFixed(4)),

      evaluationMethod: "global_temporal_cutoff_70pct",
      cutoffTimestamp: new Date(cutoffTime).toISOString(),
      forecasting: { mae: 0, rmse: 0, mape: 0, baselineMae: 0, baselineRmse: 0 },
    };

    // ── Forecasting metrics ───────────────────────────────────────────────────
    try {
      const { data: allForecasts } = await supabase
        .from("attendance_forecasts")
        .select("*")
        .order("forecast_date", { ascending: true });

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
          // Debug MAPE
          console.log(`[EVAL-MAPE] Sample Actuals (first 5): ${actuals.slice(0, 5).join(', ')}`);
          console.log(`[EVAL-MAPE] Sample Preds   (first 5): ${preds.slice(0, 5).map(p => p.toFixed(2)).join(', ')}`);

          metrics.forecasting.mae = parseFloat(mae(actuals, preds).toFixed(4));
          metrics.forecasting.rmse = parseFloat(rmse(actuals, preds).toFixed(4));
          metrics.forecasting.mape = parseFloat(mape(actuals, preds).toFixed(4));
          metrics.forecasting.baselineMae = parseFloat(mae(actuals, basePreds).toFixed(4));
          metrics.forecasting.baselineRmse = parseFloat(rmse(actuals, basePreds).toFixed(4));
        }

        // ── Grab a sample for the UI Chart ──────────────────────────────────────
        const sampleEventId = allForecasts[0].event_id;
        const sampleForecasts = allForecasts.filter(f => f.event_id === sampleEventId);

        // Generate last 14 days of historical data for the sample event
        const sampleHistorical: any[] = [];
        const firstForecastDate = new Date(sampleForecasts[0].forecast_date).getTime();

        for (let i = 14; i > 0; i--) {
          const d = new Date(firstForecastDate - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          const actualH = bookingsByEventDate.get(`${sampleEventId}_${d}`) || 0;

          sampleHistorical.push({
            name: d,
            count: actualH,
            isForecast: false
          });
        }

        const samplePredictions: any[] = sampleForecasts.map(f => ({
          name: new Date(f.forecast_date).toISOString().split("T")[0],
          predicted: Math.round(f.predicted_attendance),
          isForecast: true
        }));

        // Seamless connection: Prepend the exact last historical coordinate 
        // to the prediction array so the Recharts Area begins exactly where history ends.
        if (sampleHistorical.length > 0 && samplePredictions.length > 0) {
          const lastH = sampleHistorical[sampleHistorical.length - 1];
          samplePredictions.unshift({
            name: lastH.name,
            predicted: lastH.count,
            isForecast: true
          });
        }

        (metrics.forecasting as any).historicalData = sampleHistorical;
        (metrics.forecasting as any).predictions = samplePredictions;
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