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

    // ── Step 1: Fetch all confirmed bookings ordered by time ──────────────────
    const { data: allBookings } = await supabase
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
    const { data: testUsers } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", eligibleUserIds)
      .limit(50);

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
      }));

      try {
        await supabase
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

    for (const testUser of testUsers) {
      try {
        const algo = new XSimGCL();
        const result = await algo.execute({
          userId: testUser.id,
          limit: 10,
          supabaseClient: supabase,
          evalMode: true,       // include all public events so past ground truth events are scoreable
          cutoffDate: new Date(cutoffTime).toISOString(), // only use training-window bookings in graph
        } as Parameters<typeof algo.execute>[0]);

        console.log(`[SIM] ${testUser.id}: ${result.recommendations.length} recommendations`);

        if (result.recommendations.length > 0) {
          // Delete existing prediction for this user before inserting new one.
          // This prevents the evaluator from reading stale pre-training predictions
          // when it does ORDER BY created_at DESC — only one row per user exists.
          await supabase
            .from("algorithm_results")
            .delete()
            .eq("user_id", testUser.id)
            .eq("algorithm_type", "xsimgcl");

          const { error: insertErr } = await supabase
            .from("algorithm_results")
            .insert({
              user_id: testUser.id,
              algorithm_type: "xsimgcl",
              input_data: {
                userId: testUser.id,
                limit: 10,
                bookingCount: userBookingCount.get(testUser.id) ?? 0,
                trainBookings: userTrainBookings.get(testUser.id)?.length ?? 0,
              },
              output_data: {
                recommendations: result.recommendations,
                coldStart: (result as { coldStart?: boolean }).coldStart ?? false,
              },
              execution_time_ms: result.metrics.executionTimeMs,
              version: "1.0.0",
            });

          if (insertErr) {
            console.error(`[SIM-ERROR] Insert failed for ${testUser.id}:`, insertErr);
          } else {
            successCount++;
          }
        }
      } catch (algoErr) {
        console.error(`[SIM-CRITICAL] XSimGCL failed for ${testUser.id}:`, algoErr);
      }
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

    let forecastSuccess = 0;
    console.log(`[SIM] iTransformer for ${forecastTargets.length} events`);

    for (const eventId of forecastTargets) {
      try {
        const forecaster = new iTransformer({ horizon: 7 });
        const forecastResult = await forecaster.execute({
          eventId,
          horizon: 7,
          supabaseClient: supabase,
        });

        await supabase.from("algorithm_results").insert({
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

        forecastSuccess++;
      } catch (err) {
        console.error(`[SIM-ERROR] iTransformer failed for ${eventId}:`, err);
      }
    }

    console.log(
      `[SIM] Done. Predictions: ${successCount}/${testUsers.length}. Forecasts: ${forecastSuccess}.`
    );

    return NextResponse.json({
      success: true,
      processed: successCount,
      total: testUsers.length,
      forecasts: forecastSuccess,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}