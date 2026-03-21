// src/lib/algorithms/itransformer/index.ts
// iTransformer: Inverted Transformer for Attendance Forecasting
//
// Paper: Liu et al., ICLR 2024 — https://arxiv.org/abs/2310.06625
//
// Pipeline:
//   1. Fetch last `lookback` days of daily bookings from Supabase
//   2. Engineer 5 feature variables per day
//   3. Embed each variable's time series as a single token (inverted = variable-as-token)
//   4. Run L encoder layers of multi-head self-attention over variable tokens
//   5. Project variable embeddings → horizon-length forecast
//   6. Denormalise + compute prediction intervals
//   7. Persist to attendance_forecasts table

import type {
  AlgorithmBase,
  AlgorithmMetrics,
  ForecastInput,
  ForecastOutput,
  AttendancePrediction,
  ValidationResult,
} from "../shared/types";
// We extend ForecastInput inline to avoid changing shared types for now
export interface ExtendedForecastInput extends ForecastInput {
  supabaseClient?: SupabaseClient;
}
import {
  fetchDailyBookings,
  fetchEventMeta,
  buildLookbackWindow,
  signalsToVariableMatrix,
  computePredictionIntervals,
  detectTrend,
  denormalise,
} from "./forecast";
import {
  embedVariable,
  encoderLayer,
  projectToForecast,
  DEFAULT_ITRANSFORMER_CONFIG,
  type iTransformerConfig,
} from "./attention";
import { supabase as defaultSupabase } from "@/services/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";

export class iTransformer
  implements AlgorithmBase<ForecastInput, ForecastOutput>
{
  readonly name = "iTransformer";
  readonly version = "1.0.0";

  private config: iTransformerConfig;

  private metrics: AlgorithmMetrics = {
    executionTimeMs: 0,
    inputSize: 0,
    outputSize: 0,
    version: this.version,
    timestamp: new Date(),
  };

  constructor(config: Partial<iTransformerConfig> = {}) {
    this.config = { ...DEFAULT_ITRANSFORMER_CONFIG, ...config };
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  validate(input: ForecastInput): ValidationResult {
    const errors: string[] = [];
    if (!input.eventId || typeof input.eventId !== "string") {
      errors.push("eventId is required");
    }
    if (input.horizon !== 7 && input.horizon !== 14) {
      errors.push("horizon must be 7 or 14");
    }
    return { isValid: errors.length === 0, errors };
  }

  // ─── Execute ─────────────────────────────────────────────────────────────────

  async execute(input: ExtendedForecastInput): Promise<ForecastOutput> {
    const start = Date.now();
    const activeSupabase = input.supabaseClient || defaultSupabase;

    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(`[iTransformer] Invalid input: ${validation.errors.join(", ")}`);
    }

    const horizon = input.horizon ?? 7;
    const confidenceLevel = input.confidenceLevel ?? this.config.confidenceLevel;
    const lookback = this.config.lookback;

    // ── Step 1: Fetch event metadata ──────────────────────────────────────────
    const { startDate, maxAttendees } = await fetchEventMeta(input.eventId);
    const eventStartDate = new Date(startDate);

    // ── Step 2: Fetch daily bookings for look-back window ─────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() - 1); // yesterday

    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - lookback);

    const dailyBookings = await fetchDailyBookings(
      input.eventId,
      windowStart,
      windowEnd
    );

    this.metrics.inputSize = dailyBookings.size;

    // ── Step 3: Build look-back feature signals ───────────────────────────────
    const signals = buildLookbackWindow(
      dailyBookings,
      eventStartDate,
      windowStart,
      windowEnd
    );

    const lastCumulative =
      signals.length > 0
        ? signals[signals.length - 1].cumulativeBookings
        : 0;

    // ── Step 4: Convert to variable matrix [NUM_VARIABLES × T] ───────────────
    const variableMatrix = signalsToVariableMatrix(signals);

    // Pad or truncate each variable series to exactly `lookback` steps
    const paddedMatrix = variableMatrix.map(series => {
      if (series.length >= lookback) return series.slice(-lookback);
      return [...new Array(lookback - series.length).fill(0), ...series];
    });

    // ── Step 5: Embed each variable as a single token (the "inverted" part) ──
    let tokens = paddedMatrix.map((series, varIdx) =>
      embedVariable(series, varIdx, this.config.dModel)
    );

    // ── Step 6: Run iTransformer encoder layers ───────────────────────────────
    for (let l = 0; l < this.config.numLayers; l++) {
      tokens = encoderLayer(tokens, this.config, l);
    }

    // ── Step 7: Variable importance weights ───────────────────────────────────
    // Heuristic: cumulative_bookings (var 1) and daily_rsvps (var 0) are most
    // predictive; days_to_event (var 2) is medium; seasonal signals (3,4) lower
    const varImportance = [0.30, 0.40, 0.15, 0.075, 0.075];

    // ── Step 8: Project to horizon-length normalised forecast ─────────────────
    const normForecast = projectToForecast(tokens, horizon, varImportance);

    // ── Step 9: Denormalise to real attendee counts ───────────────────────────
    const rawCounts = denormalise(normForecast, lastCumulative, maxAttendees);

    // ── Step 10: Prediction intervals ─────────────────────────────────────────
    const intervals = computePredictionIntervals(
      rawCounts,
      confidenceLevel,
      maxAttendees
    );

    // ── Step 11: Build date labels for forecast days ───────────────────────────
    const forecastStart = new Date(today);
    const predictions: AttendancePrediction[] = rawCounts.map((count, i) => {
      const forecastDate = new Date(forecastStart);
      forecastDate.setDate(forecastDate.getDate() + i);
      return {
        date: forecastDate.toISOString().split("T")[0],
        predictedAttendance: Math.round(count),
        lowerBound: intervals[i].lower,
        upperBound: intervals[i].upper,
        confidence: confidenceLevel,
      };
    });

    const trend = detectTrend(rawCounts);
    const recommendedCapacity = Math.ceil(
      Math.max(...predictions.map(p => p.upperBound)) * 1.1 // 10% safety buffer
    );

    // ── Step 12: Persist to attendance_forecasts ──────────────────────────────
    await this.persistForecasts(input.eventId, predictions, trend, activeSupabase);

    this.metrics = {
      executionTimeMs: Date.now() - start,
      inputSize: signals.length,
      outputSize: predictions.length,
      version: this.version,
      timestamp: new Date(),
    };

    return {
      eventId: input.eventId,
      predictions,
      trend,
      recommendedCapacity,
      metrics: this.metrics,
    };
  }

  // ─── Persist ─────────────────────────────────────────────────────────────────

  private async persistForecasts(
    eventId: string,
    predictions: AttendancePrediction[],
    trend: string,
    supabaseClient: SupabaseClient
  ): Promise<void> {
    const rows = predictions.map(p => ({
      event_id: eventId,
      forecast_date: p.date,
      predicted_attendance: p.predictedAttendance,
      lower_bound: p.lowerBound,
      upper_bound: p.upperBound,
      confidence: p.confidence,
      trend,
      model_version: this.version,
    }));

    // Upsert — unique constraint on (event_id, forecast_date)
    const { error } = await supabaseClient
      .from("attendance_forecasts")
      .upsert(rows, { onConflict: "event_id,forecast_date" });
      
    if (error) {
      console.error("[iTransformer] Failed to upsert forecasts:", error);
    }
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────────

  getMetrics(): AlgorithmMetrics {
    return this.metrics;
  }
}
