// src/components/events/ForecastPanel.tsx
// Attendance forecast panel — shown in Event Control tab (organizer only)

"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/services/supabase/client";
import { ResponsiveContainer, ComposedChart, Bar, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Prediction {
  date: string;
  predictedAttendance: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface ForecastData {
  predictions: Prediction[];
  trend: "increasing" | "decreasing" | "stable";
  recommendedCapacity: number;
  executionTimeMs: number;
  cached?: boolean;
}

function ForecastTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: readonly { payload: Prediction }[];
  label?: string | number;
}) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const d = new Date(String(label ?? '')).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 shadow-xl">
      <p className="font-bold text-[var(--color-text-primary)] mb-1">{d}</p>
      <p className="text-sm font-semibold text-[var(--color-brand)]">{data.predictedAttendance} predicted</p>
      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
        Range: {data.lowerBound} – {data.upperBound} ({(data.confidence * 100).toFixed(0)}% CI)
      </p>
    </div>
  );
}

interface Props {
  eventId: string;
}

export function ForecastPanel({ eventId }: Props) {
  const { session } = useAuth();
  const [horizon, setHorizon] = useState<7 | 14>(7);
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventData, setEventData] = useState<{current: number, max: number | null} | null>(null);

  async function runForecast(h: 7 | 14) {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const { data: evData } = await supabase.from('events').select('attendee_count, max_attendees').eq('id', eventId).single();
      if (evData) {
        setEventData({ current: evData.attendee_count || 0, max: evData.max_attendees });
      }

      const res = await fetch("/api/algorithms/forecast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId, horizon: h }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Forecast failed"); return; }
      setData(json);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { runForecast(horizon); }, [eventId]); // eslint-disable-line

  function handleHorizonChange(h: 7 | 14) {
    setHorizon(h);
    runForecast(h);
  }

  const trendConfig = {
    increasing: { icon: TrendingUp, label: "Growing", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    decreasing: { icon: TrendingDown, label: "Declining", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
    stable: { icon: Minus, label: "Stable", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  };

  const trend = data ? trendConfig[data.trend] : null;
  const TrendIcon = trend?.icon ?? Minus;

  // UX-02: Actionable advice sentence
  let advice = "";
  if (data && eventData) {
    const { current, max } = eventData;
    const { trend, predictions } = data;
    
    const exceedingDate = max ? predictions.find(p => p.upperBound > max) : null;
    
    if (exceedingDate) {
      const d = new Date(exceedingDate.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      advice = `Forecast suggests attendance could exceed your max capacity of ${max} by ${d}. Consider increasing capacity or preparing a waitlist.`;
    } else if (trend === "increasing" && max && current > max * 0.7) {
      advice = `Bookings are growing steadily and you are over 70% full. You may reach capacity soon — consider closing registration early.`;
    } else if (trend === "decreasing") {
      advice = `Booking momentum is declining. This might be a good time for a targeted promotional push or discount offer.`;
    } else {
      advice = `Attendance is tracking steadily with typical booking curves.`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Attendance Forecast</h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
            Predicted attendance for the next {horizon} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--color-background)] border border-[var(--color-border)] rounded-full p-1">
            {([7, 14] as const).map(h => (
              <button
                key={h}
                onClick={() => handleHorizonChange(h)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${horizon === h
                    ? "bg-[var(--color-brand)] text-white shadow"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                  }`}
              >
                {h}d
              </button>
            ))}
          </div>
          <button
            onClick={() => runForecast(horizon)}
            disabled={loading}
            className="p-2 rounded-full border border-[var(--color-border)] hover:border-[var(--color-brand)] text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] transition-all disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle size={16} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-3 animate-pulse">
          <div className="flex items-end gap-2 h-44">
            {Array.from({ length: horizon }).map((_, i) => (
              <div key={i} className="flex-1 bg-[var(--color-surface-hover)] rounded-t-lg" style={{ height: `${30 + (i * 7) % 60}%` }} />
            ))}
          </div>
          <div className="h-4 bg-[var(--color-surface-hover)] rounded w-48" />
        </div>
      )}

      {/* Chart */}
      {data && (
        <div className="space-y-4">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-3">
            {trend && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${trend.bg} ${trend.color}`}>
                <TrendIcon size={12} /> {trend.label} trend
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text-secondary)]">
              Suggested capacity: <span className="text-[var(--color-brand)] ml-1">{data.recommendedCapacity}</span>
            </div>
            {data.cached && (
              <div className="px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-tertiary)]">
                Cached
              </div>
            )}
          </div>

          {/* Recharts Chart */}
          <div className="w-full relative aspect-[2] min-h-[200px]" style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.predictions} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val: string) => new Date(val).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--color-surface-hover)' }}
                  content={<ForecastTooltip />}
                />
                
                <Area 
                  type="monotone" 
                  dataKey="upperBound" 
                  fill="var(--color-brand)" 
                  fillOpacity={0.1} 
                  stroke="none"
                  className="hidden sm:block"
                />
                <Area 
                  type="monotone" 
                  dataKey="lowerBound" 
                  fill="var(--color-background)" 
                  fillOpacity={1} 
                  stroke="none"
                  className="hidden sm:block" 
                  style={{ visibility: 'hidden' }}
                />
                
                <Bar 
                  dataKey="predictedAttendance" 
                  fill="var(--color-brand)" 
                  radius={[2, 2, 0, 0]}
                  barSize={horizon === 14 ? 12 : 24}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-4 text-[11px] text-[var(--color-text-tertiary)]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[var(--color-brand)]" /> Predicted
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[var(--color-brand)]/20" /> Confidence interval
              </div>
            </div>
            {advice && (
              <div className="text-xs text-[var(--color-text-secondary)] font-medium max-w-[80%] border-l-2 border-[var(--color-brand)] pl-3">
                {advice}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
