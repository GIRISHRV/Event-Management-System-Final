// src/app/api/algorithms/forecast/route.ts
// Attendance forecasting endpoint — organizer only
//
// POST /api/algorithms/forecast
// Body: { eventId: string, horizon: 7 | 14, confidenceLevel?: number }
//
// Auth: must be the event organizer (user_id check)
// Cache: results cached for 1 hour in attendance_forecasts table

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { iTransformer } from "@/lib/algorithms/itransformer";

// ─── Input Schema ──────────────────────────────────────────────────────────────

const ForecastRequestSchema = z.object({
  eventId: z.string().uuid("eventId must be a valid UUID"),
  horizon: z.union([z.literal(7), z.literal(14)]).default(7),
  confidenceLevel: z.number().min(0.8).max(0.99).optional().default(0.95),
});

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
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
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // ── Validate body ─────────────────────────────────────────────────────────
    const body = await request.json();
    const parsed = ForecastRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { eventId, horizon, confidenceLevel } = parsed.data;

    // ── Verify organizer owns this event ──────────────────────────────────────
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, user_id, event_name")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.user_id !== user.id) {
      return NextResponse.json(
        { error: "Only the event organizer can request a forecast" },
        { status: 403 }
      );
    }

    // ── Check cache in attendance_forecasts ───────────────────────────────────
    const { data: cached } = await supabase
      .from("attendance_forecasts")
      .select("forecast_date, predicted_attendance, lower_bound, upper_bound, confidence, trend, created_at")
      .eq("event_id", eventId)
      .gte("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order("forecast_date", { ascending: true })
      .limit(horizon);

    if (cached && cached.length >= horizon) {
      logger.info(`[Forecast] Returning cached forecast for eventId=${eventId}`);

      const trend = cached[0]?.trend ?? "stable";
      const maxPredicted = Math.max(...cached.map(r => r.upper_bound));

      // ── Fetch historical data for comparison ──
      const { data: history } = await supabase
        .from("bookings")
        .select("created_at")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: true });

      const historyMap = new Map<string, number>();
      (history ?? []).forEach(b => {
        const d = new Date(b.created_at).toISOString().split('T')[0];
        historyMap.set(d, (historyMap.get(d) || 0) + 1);
      });
      const historicalData = Array.from(historyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .slice(-14);

      return NextResponse.json({
        success: true,
        eventId,
        historicalData,
        predictions: cached.map(r => ({
          name: r.forecast_date,
          predicted: Math.round(r.predicted_attendance),
          lowerBound: r.lower_bound,
          upperBound: r.upper_bound,
          confidence: r.confidence,
          isForecast: true,
        })),
        trend,
        recommendedCapacity: Math.ceil(maxPredicted * 1.1),
        cached: true,
        executionTimeMs: Date.now() - startTime,
      });
    }

    // ── Run iTransformer ──────────────────────────────────────────────────────
    logger.info(`[Forecast] Running iTransformer for eventId=${eventId}, horizon=${horizon}`);

    const algo = new iTransformer({ horizon });
    const result = await algo.execute({ eventId, horizon, confidenceLevel });

    // ── Log to algorithm_results for paper ────────────────────────────────────
    await supabase.from("algorithm_results").insert({
      user_id: user.id,
      algorithm_type: "itransformer",
      input_data: { eventId, horizon, confidenceLevel },
      output_data: {
        trend: result.trend,
        recommendedCapacity: result.recommendedCapacity,
        numPredictions: result.predictions.length,
      },
      execution_time_ms: result.metrics.executionTimeMs,
      version: "1.0.0",
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });

    logger.info(
      `[Forecast] Completed in ${Date.now() - startTime}ms, trend=${result.trend}`
    );

    // ── Fetch historical data for comparison ──
    const { data: history } = await supabase
      .from("bookings")
      .select("created_at")
      .eq("event_id", eventId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    // Aggregate daily confirmed bookings (cumulative or daily)
    const historyMap = new Map<string, number>();
    (history ?? []).forEach(b => {
      const d = new Date(b.created_at).toISOString().split('T')[0];
      historyMap.set(d, (historyMap.get(d) || 0) + 1);
    });
    const historicalData = Array.from(historyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .slice(-14); // Last 14 days

    return NextResponse.json({
      success: true,
      eventId,
      historicalData,
      predictions: result.predictions,
      trend: result.trend,
      recommendedCapacity: result.recommendedCapacity,
      executionTimeMs: result.metrics.executionTimeMs,
    });
  } catch (err: unknown) {
    logger.error("[Forecast] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate forecast",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
