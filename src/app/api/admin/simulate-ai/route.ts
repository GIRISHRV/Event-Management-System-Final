// src/app/api/admin/simulate-ai/route.ts
//
// Generates XSimGCL predictions for all users who have enough bookings
// for the temporal train/test split to work.
//
// Key fixes:
// 1. Removed evaluser_ email filter — runs for ALL users with >= 3 bookings,
//    which are the same users the evaluator finds ground truth for.
// 2. Syncs each user's confirmed bookings into user_interactions before
//    running XSimGCL, so BPR training has data to work with.
//    Only writes training-window interactions (no test-window events).
// 3. Uses the same global 70th-percentile cutoff as the evaluator.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { XSimGCL } from "@/lib/algorithms/xsimgcl";
import { iTransformer } from "@/lib/algorithms/itransformer";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { global: { headers: { "ngrok-skip-browser-warning": "true" } } });

    // ── Step 1: Fetch all confirmed bookings ordered by time ──────────────────
    const { data: allBookings } = await adminSupabase
      .from("bookings")
      .select("user_id, event_id, created_at, status")
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    const bookings = allBookings || [];

    // ── Step 2: Compute global 70th-percentile cutoff (same as evaluator) ─────
    const allTimes = bookings
      .map((b: { created_at: string }) => new Date(b.created_at).getTime())
      .sort((a: number, b: number) => a - b);

    const cutoffTime = allTimes.length > 0
      ? allTimes[Math.floor(allTimes.length * 0.7)]
      : Date.now();

    console.log(`[SIM] Global cutoff: ${new Date(cutoffTime).toISOString()} (${allTimes.length} bookings)`);

    // ── Step 3: Group bookings by user, split into train/test ─────────────────
    const userTrainBookings = new Map<string, { event_id: string; created_at: string }[]>();
    const userBookingCount = new Map<string, number>();

    for (const b of bookings) {
      userBookingCount.set(b.user_id, (userBookingCount.get(b.user_id) || 0) + 1);
      const t = new Date(b.created_at).getTime();
      if (t <= cutoffTime) {
        if (!userTrainBookings.has(b.user_id)) userTrainBookings.set(b.user_id, []);
        userTrainBookings.get(b.user_id)!.push({ event_id: b.event_id, created_at: b.created_at });
      }
    }

    // Mirror EXACTLY what evaluate/route.ts does:
    // eligible = users with >= 1 booking AFTER cutoff (test data)
    //         AND >= 1 booking AT OR BEFORE cutoff (training signal)
    // This guarantees simulate and evaluate operate on the identical user set.
    const userTestBookingCount = new Map<string, number>();
    for (const b of bookings) {
      const t = new Date(b.created_at).getTime();
      if (t > cutoffTime) {
        userTestBookingCount.set(b.user_id, (userTestBookingCount.get(b.user_id) || 0) + 1);
      }
    }

    // Users who have test data AND training data
    const eligibleUserIds = [...userTestBookingCount.keys()]
      .filter(uid => (userTrainBookings.get(uid)?.length ?? 0) >= 1);

    if (eligibleUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        total: 0,
        message: "No users found with bookings on both sides of the temporal cutoff.",
      });
    }

    // Fetch profiles (no email filter — we want all real users with enough data)
    const { data: testUsers } = await adminSupabase
      .from("profiles")
      .select("id, email")
      .in("id", eligibleUserIds);

    if (!testUsers || testUsers.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        total: 0,
        message: "Could not fetch profiles for eligible users.",
      });
    }

    console.log(`[SIM] Generating predictions for ${testUsers.length} users`);

    // ── Step 4: Sync training bookings → user_interactions for BPR ───────────
    // BPR reads from user_interactions. Users who only have bookings rows
    // (not user_interactions rows) give BPR nothing to train on.
    // We sync only training-window confirmed bookings — not test-window events.
    for (const testUser of testUsers) {
      const trainBookings = userTrainBookings.get(testUser.id) || [];
      if (trainBookings.length === 0) continue;

      const interactionRows = trainBookings.map((b: { event_id: string; created_at: string }) => ({
        user_id: testUser.id,
        event_id: b.event_id,
        interaction_type: "confirmed",
        implicit_score: 1.0,
        split: "train",
      }));

      try {
        await adminSupabase
          .from("user_interactions")
          .upsert(interactionRows, {
            onConflict: "user_id,event_id,interaction_type",
            ignoreDuplicates: true,
          });
      } catch (err: unknown) {
        console.warn(`[SIM] Interaction sync warning for ${testUser.id}:`, err);
      }
    }

    // ── Step 5: Run XSimGCL for each user ─────────────────────────────────────
    let successCount = 0;
    let sampleRecs: any[] = [];

    for (const testUser of testUsers) {
      try {
        const algo = new XSimGCL();
        const result = await algo.execute({
          userId: testUser.id,
          limit: 10,
          supabaseClient: adminSupabase,
          evalMode: true,
          cutoffDate: new Date(cutoffTime).toISOString(),
        } as Parameters<typeof algo.execute>[0]);

        if (result.recommendations.length > 0) {
          if (sampleRecs.length === 0) {
            const { data: userTags } = await adminSupabase.from("user_interactions").select("events(tags)").eq("user_id", testUser.id);
            const tagCounts = new Map<string, number>();
            userTags?.forEach((row: any) => {
              const evt = (Array.isArray(row.events) ? row.events[0] : row.events) as { tags?: string[] } | null;
              const tags = evt?.tags || [];
              tags.forEach((t: string) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
            });

            const recIds = result.recommendations.map(r => r.eventId);
            const { data: events } = await adminSupabase.from("events").select("id, tags").in("id", recIds);
            const evtTagsMap = new Map((events || []).map(e => [e.id, e.tags || []]));

            sampleRecs = result.recommendations.map(r => {
              const tags = evtTagsMap.get(r.eventId) || [];
              const sortedTags = [...tags].sort((a, b) => (tagCounts.get(b) || 0) - (tagCounts.get(a) || 0));
              const bestTag = sortedTags[0];
              return {
                ...r,
                reason: bestTag && tagCounts.get(bestTag) ? `Matched your interest in ${bestTag.toLowerCase()}` : "Recommended similarity"
              };
            }).slice(0, 3);
          }

          await adminSupabase
            .from("algorithm_results")
            .delete()
            .eq("user_id", testUser.id)
            .eq("algorithm_type", "xsimgcl");

          const { error: insertErr } = await adminSupabase
            .from("algorithm_results")
            .insert({
              user_id: testUser.id,
              algorithm_type: "xsimgcl",
              input_data: { userId: testUser.id, limit: 10 },
              output_data: {
                recommendations: result.recommendations,
                sampleRecommendations: sampleRecs,
              },
              execution_time_ms: result.metrics.executionTimeMs,
              version: "1.0.0",
            });

          if (!insertErr) successCount++;
        }
      } catch (err) { console.error(err); }
    }

    // ── Step 6: iTransformer forecasts ────────────────────────────────────────
    const eventDayMap = new Map<string, Set<string>>();
    for (const b of bookings) {
      const day = b.created_at.split("T")[0];
      if (!eventDayMap.has(b.event_id)) eventDayMap.set(b.event_id, new Set());
      eventDayMap.get(b.event_id)!.add(day);
    }

    const forecastTargets = [...eventDayMap.entries()]
      .filter(([, days]) => days.size >= 7)
      .map(([id]) => id)
      .slice(0, 5);

    let forecastSuccessCount = 0;
    for (const eventId of forecastTargets) {
      try {
        // Backtest: evaluate on the last 7 days of known ground truth
        const anchorDate = new Date();
        anchorDate.setDate(anchorDate.getDate() - 7);

        const forecaster = new iTransformer({ horizon: 7 });
        const forecastResult = await forecaster.execute({
          eventId,
          horizon: 7,
          supabaseClient: adminSupabase,
          anchorDate
        } as any);

        await adminSupabase.from("algorithm_results").insert({
          user_id: testUsers[0]?.id || null,
          algorithm_type: "itransformer",
          input_data: { eventId, horizon: 7 },
          output_data: {
            trend: forecastResult.trend,
            recommendedCapacity: forecastResult.recommendedCapacity,
          },
          execution_time_ms: forecastResult.metrics.executionTimeMs,
          version: "1.0.0",
        });

        forecastSuccessCount++;
      } catch (err) { console.error(err); }
    }

    return NextResponse.json({
      success: true,
      processed: successCount,
      total: testUsers.length,
      forecasts: forecastSuccessCount,
      sampleRecommendations: sampleRecs,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}