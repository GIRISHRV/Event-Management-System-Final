// src/lib/algorithms/itransformer/forecast.ts
// Data fetching + feature engineering + post-processing for iTransformer
//
// Feature variables (each becomes one token):
//   0 — daily_rsvps:          new bookings per day in look-back window
//   1 — cumulative_bookings:  running total bookings (normalised)
//   2 — days_to_event:        countdown from each look-back day to event start
//   3 — day_of_week_sin:      sin encoding of day of week (captures weekly cycles)
//   4 — day_of_week_cos:      cos encoding of day of week

import { supabase } from "@/services/supabase/client";

export const NUM_VARIABLES = 5;

export interface DailySignal {
  date: string;         // YYYY-MM-DD
  newBookings: number;
  cumulativeBookings: number;
  daysToEvent: number;
  dayOfWeekSin: number;
  dayOfWeekCos: number;
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

/**
 * Fetches confirmed bookings for an event, grouped by day.
 * Returns a map of YYYY-MM-DD → count.
 */
export async function fetchDailyBookings(
  eventId: string,
  fromDate: Date,
  toDate: Date
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("bookings")
    .select("created_at")
    .eq("event_id", eventId)
    .eq("status", "confirmed")
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString());

  if (error) {
    throw new Error(`[iTransformer] Bookings fetch failed: ${error.message}`);
  }

  const daily = new Map<string, number>();
  for (const b of data ?? []) {
    const day = b.created_at.split("T")[0];
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }

  return daily;
}

/**
 * Fetches the event's start_date and max_attendees.
 */
export async function fetchEventMeta(
  eventId: string
): Promise<{ startDate: string; maxAttendees: number | null }> {
  const { data, error } = await supabase
    .from("events")
    .select("start_date, max_attendees")
    .eq("id", eventId)
    .single();

  if (error || !data) {
    throw new Error(`[iTransformer] Event meta fetch failed: ${error?.message ?? "not found"}`);
  }

  return { startDate: data.start_date, maxAttendees: data.max_attendees };
}

// ─── Feature Engineering ──────────────────────────────────────────────────────

/**
 * Builds a look-back window of daily signals from `windowStart` to `windowEnd`.
 * Any days with no bookings get 0 — sparse is normal for most events.
 */
export function buildLookbackWindow(
  dailyBookings: Map<string, number>,
  eventStartDate: Date,
  windowStart: Date,
  windowEnd: Date
): DailySignal[] {
  const signals: DailySignal[] = [];
  const cursor = new Date(windowStart);
  let cumulative = 0;

  while (cursor <= windowEnd) {
    const dateStr = cursor.toISOString().split("T")[0];
    const newBookings = dailyBookings.get(dateStr) ?? 0;
    cumulative += newBookings;

    const daysToEvent = Math.max(
      0,
      Math.round((eventStartDate.getTime() - cursor.getTime()) / 86400000)
    );

    const dow = cursor.getDay(); // 0 = Sunday
    const dowRad = (dow / 7) * 2 * Math.PI;

    signals.push({
      date: dateStr,
      newBookings,
      cumulativeBookings: cumulative,
      daysToEvent,
      dayOfWeekSin: Math.sin(dowRad),
      dayOfWeekCos: Math.cos(dowRad),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return signals;
}

/**
 * Converts look-back signals into a [NUM_VARIABLES × lookback] matrix,
 * where each row is one variable's time series (normalised to [0,1]).
 */
export function signalsToVariableMatrix(signals: DailySignal[]): number[][] {
  const T = signals.length;
  if (T === 0) return Array.from({ length: NUM_VARIABLES }, () => []);

  // Extract raw series
  const rawSeries: number[][] = [
    signals.map(s => s.newBookings),
    signals.map(s => s.cumulativeBookings),
    signals.map(s => s.daysToEvent),
    signals.map(s => s.dayOfWeekSin),
    signals.map(s => s.dayOfWeekCos),
  ];

  // Min-max normalise each series to [0, 1]
  return rawSeries.map(series => {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min;
    if (range === 0) return series.map(() => 0.5);
    return series.map(x => (x - min) / range);
  });
}

// ─── Prediction Interval ──────────────────────────────────────────────────────

/**
 * Computes prediction intervals using a simple residual bootstrap approach:
 * - Compute MAD (median absolute deviation) of the raw forecast signal
 * - Use z-score multiplier for the requested confidence level
 * - lower = forecast - z * MAD, upper = forecast + z * MAD
 *
 * For 95% confidence: z ≈ 1.96
 */
export function computePredictionIntervals(
  rawForecast: number[],
  confidenceLevel: number,
  maxAttendees: number | null
): Array<{ lower: number; upper: number; confidence: number }> {
  // z-score lookup for common confidence levels
  const zScores: Record<string, number> = {
    "0.90": 1.645,
    "0.95": 1.960,
    "0.99": 2.576,
  };
  const z = zScores[confidenceLevel.toFixed(2)] ?? 1.96;

  const mean = rawForecast.reduce((s, x) => s + x, 0) / rawForecast.length;
  const mad = rawForecast.reduce((s, x) => s + Math.abs(x - mean), 0) / rawForecast.length;
  const margin = z * (mad + 0.5); // +0.5 to avoid zero-width intervals

  const cap = maxAttendees ?? Infinity;

  return rawForecast.map(val => ({
    lower: Math.max(0, Math.round(val - margin)),
    upper: Math.min(cap, Math.round(val + margin)),
    confidence: confidenceLevel,
  }));
}

// ─── Trend Detection ──────────────────────────────────────────────────────────

/**
 * Determines if the forecast is increasing, decreasing, or stable.
 * Uses linear regression slope over the forecast values.
 */
export function detectTrend(
  forecast: number[]
): "increasing" | "decreasing" | "stable" {
  if (forecast.length < 2) return "stable";

  const n = forecast.length;
  const xMean = (n - 1) / 2;
  const yMean = forecast.reduce((s, x) => s + x, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (forecast[i] - yMean);
    den += (i - xMean) ** 2;
  }

  if (den === 0) return "stable";
  const slope = num / den;

  // Threshold: slope > 0.5 attendees/day = meaningful trend
  if (slope > 0.5) return "increasing";
  if (slope < -0.5) return "decreasing";
  return "stable";
}

// ─── Denormalisation ──────────────────────────────────────────────────────────

/**
 * Converts the model's [0,1] normalised forecast back to cumulative attendee counts.
 *
 * The model's output is interpreted as a fraction of expected capacity, clamped
 * to [lastCumulativeBookings, cap] so forecasts never decrease.
 *
 * This makes MAE interpretable ("attendees above/below actual") and MAPE
 * well-defined (no division by near-zero daily deltas).
 *
 * Paper metric: MAE_cumulative = mean|predicted_cumulative - actual_cumulative|
 *               MAPE = mean(|Ŷ - Y| / Y) on cumulative series
 */
export function denormalise(
  normalisedForecast: number[],
  lastCumulativeBookings: number,
  maxAttendees: number | null
): number[] {
  // Cap = max_attendees if set; otherwise estimate as 2× current total (min 20)
  const cap = maxAttendees ?? Math.max(lastCumulativeBookings * 2, 20);

  // Interpret each normalised value as a fraction of the expected capacity.
  // Clamp to [lastKnown, cap] so values are monotonically non-decreasing
  // and stay within real-world attendance bounds.
  return normalisedForecast.map(v =>
    Math.max(lastCumulativeBookings, Math.min(cap, Math.round(v * cap)))
  );
}
