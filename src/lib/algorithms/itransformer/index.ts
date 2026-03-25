// src/lib/algorithms/itransformer/index.ts
// iTransformer: Inverted Transformer for Attendance Forecasting
//
// Paper: Liu et al., ICLR 2024 — https://arxiv.org/abs/2310.06625

import type {
  AlgorithmBase,
  AlgorithmMetrics,
  ForecastInput,
  ForecastOutput,
  AttendancePrediction,
  ValidationResult,
} from "../shared/types";
import {
  fetchDailyBookings,
  fetchEventMeta,
  buildLookbackWindow,
  signalsToVariableMatrix,
  computePredictionIntervals,
  detectTrend,
  denormalise,
  NUM_VARIABLES,
} from "./forecast";
import {
  embedVariable,
  encoderLayer,
  projectToForecast,
  generateInitialWeights,
  DEFAULT_ITRANSFORMER_CONFIG,
  type iTransformerConfig,
  type ITransformerWeights,
} from "./attention";
import { supabase as defaultSupabase } from "@/services/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";

// We extend ForecastInput inline to avoid changing shared types for now
export interface ExtendedForecastInput extends ForecastInput {
  supabaseClient?: SupabaseClient;
  anchorDate?: Date;
}

export class iTransformer
  implements AlgorithmBase<ForecastInput, ForecastOutput>
{
  readonly name = "iTransformer";
  readonly version = "1.0.0";

  private config: iTransformerConfig;
  private weights: ITransformerWeights | null = null;

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

  // ─── Weight Management ───────────────────────────────────────────────────────

  private async loadWeights(supabase: SupabaseClient): Promise<ITransformerWeights> {
    if (this.weights) return this.weights;

    const { data, error } = await supabase
      .from("algorithm_results")
      .select("output_data")
      .eq("algorithm_type", "itransformer_weights")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log("[iTransformer] No weights found, generating initial...");
      this.weights = generateInitialWeights(NUM_VARIABLES, this.config);
      await this.saveWeights(supabase);
      return this.weights;
    }

    this.weights = data.output_data as unknown as ITransformerWeights;
    return this.weights;
  }

  private async saveWeights(supabase: SupabaseClient): Promise<void> {
    if (!this.weights) return;

    await supabase.from("algorithm_results").insert({
      algorithm_type: "itransformer_weights",
      output_data: this.weights as any,
      execution_time_ms: 0,
    });
  }

  /**
   * Extremely simplified training nudge based on prediction error.
   */
  private async trainOnData(
    tokens: number[][],
    paddedMatrix: number[][],
    actualNextDay: number,
    lastCumulative: number,
    maxAttendees: number | null,
    supabase: SupabaseClient
  ) {
    if (!this.weights) return;

    const varImportance = [0.30, 0.40, 0.15, 0.075, 0.075];
    const normForecast = projectToForecast(tokens, 1, varImportance, this.weights.W_out);
    const pred = denormalise(normForecast, lastCumulative, maxAttendees)[0];

    const error = actualNextDay - pred;
    const learningRate = 0.005; 
    const lookback = this.config.lookback;

    // 1. Nudge W_out (Output Projector)
    if (Math.abs(error) > 0.01) {
      for (let v = 0; v < NUM_VARIABLES; v++) {
        for (let d = 0; d < this.config.dModel; d++) {
          this.weights.W_out[v][0][d] += error * tokens[v][d] * learningRate * varImportance[v];
        }
      }

      // 2. Nudge W_proj (Temporal Projector)
      // error * tokens[v][d] * series[v][t]
      for (let v = 0; v < NUM_VARIABLES; v++) {
        for (let d = 0; d < this.config.dModel; d++) {
          for (let t = 0; t < lookback; t++) {
            this.weights.W_proj[v][d][t] +=
              error * tokens[v][d] * (paddedMatrix[v]?.[t] || 0) * learningRate * varImportance[v];
          }
        }
      }
      
      await this.saveWeights(supabase);
    }
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

    const weights = await this.loadWeights(activeSupabase);

    const horizon = input.horizon ?? 7;
    const confidenceLevel = input.confidenceLevel ?? this.config.confidenceLevel;
    const lookback = this.config.lookback;

    // ── Step 1: Fetch event metadata ──────────────────────────────────────────
    const { startDate, maxAttendees } = await fetchEventMeta(input.eventId);
    const eventStartDate = new Date(startDate);

    // ── Step 2: Fetch daily bookings ──────────────────────────────────────────
    const today = input.anchorDate ? new Date(input.anchorDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() - 1);

    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - lookback);

    const dailyBookings = await fetchDailyBookings(input.eventId, windowStart, windowEnd);
    this.metrics.inputSize = dailyBookings.size;

    // ── Step 3: Build feature signals ────────────────────────────────────────
    const signals = buildLookbackWindow(dailyBookings, eventStartDate, windowStart, windowEnd);

    const lastCumulative =
      signals.length > 0 ? signals[signals.length - 1].cumulativeBookings : 0;

    // ── Step 4: Convert to variable matrix ──────────────────────────────────
    const variableMatrix = signalsToVariableMatrix(signals);
    const paddedMatrix = variableMatrix.map(series => {
      if (series.length >= lookback) return series.slice(-lookback);
      return [...new Array(lookback - series.length).fill(0), ...series];
    });

    // ── Step 5: Embed variables ─────────────────────────────────────────────
    let tokens = paddedMatrix.map((series, varIdx) =>
      embedVariable(series, varIdx, weights.W_proj)
    );

    // ── Step 6: Encoder layers ──────────────────────────────────────────────
    for (let l = 0; l < this.config.numLayers; l++) {
      const layerWeights = {
        W_q: weights.W_q[l],
        W_k: weights.W_k[l],
        W_v: weights.W_v[l],
        W_ff1: weights.W_ff1[l],
        W_ff2: weights.W_ff2[l],
      };
      tokens = encoderLayer(tokens, this.config, layerWeights);
    }

    const varImportance = [0.30, 0.40, 0.15, 0.075, 0.075];

    // ── Step 7: Project to forecast ─────────────────────────────────────────
    const normForecast = projectToForecast(tokens, horizon, varImportance, weights.W_out);

    // ── Step 8: Denormalise ─────────────────────────────────────────────────
    const rawCounts = denormalise(normForecast, lastCumulative, maxAttendees);

    // ── Step 9: Intervals ───────────────────────────────────────────────────
    const intervals = computePredictionIntervals(rawCounts, confidenceLevel, maxAttendees);

    const actualToday = dailyBookings.get(today.toISOString().split("T")[0]) ?? 0;
    if (actualToday > 0) { // Only train when there's real signal
      await this.trainOnData(tokens, paddedMatrix, lastCumulative + actualToday, lastCumulative, maxAttendees, activeSupabase);
    }

    // ── Step 11: Predictions ────────────────────────────────────────────────
    const forecastStart = new Date(today);
    const predictions: AttendancePrediction[] = rawCounts.map((count, i) => {
      const forecastDate = new Date(forecastStart);
      forecastDate.setDate(forecastDate.getDate() + i);
      return {
        date: forecastDate.toISOString().split("T")[0],
        predictedAttendance: Math.round(count),
        lowerBound: intervals[i]?.lower ?? Math.round(count * 0.9),
        upperBound: intervals[i]?.upper ?? Math.round(count * 1.1),
        confidence: confidenceLevel,
      };
    });

    const trend = detectTrend(rawCounts);
    const recommendedCapacity = Math.ceil(
      Math.max(...predictions.map(p => p.upperBound)) * 1.1
    );

    // ── Step 12: Persist ─────────────────────────────────────────────────────
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

    await supabaseClient
      .from("attendance_forecasts")
      .upsert(rows, { onConflict: "event_id,forecast_date" });
  }

  getMetrics(): AlgorithmMetrics {
    return this.metrics;
  }
}
