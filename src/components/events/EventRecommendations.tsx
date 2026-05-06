"use client";

// src/components/events/EventRecommendations.tsx
// Personalized event recommendations powered by XSimGCL (IEEE TKDE 2024)
// Falls back to GNN Cross-Domain CF for cold-start users (< 3 interactions)

import { useState, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Calendar, MapPin, RefreshCw, Zap } from "lucide-react";
import type { Event } from "@/lib/supabase-types";
import { RecommendationCardSkeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/services/supabase/client";

// Fire-and-forget recommendation click tracking (#9)
function trackRecommendationClick(userId: string, eventId: string) {
  supabase.from("user_interactions").upsert({
    user_id: userId,
    event_id: eventId,
    interaction_type: "recommendation_click",
    implicit_score: 0.5,
  }, { onConflict: "user_id,event_id,interaction_type" }).then(() => {
    // Invalidate xsimgcl cache for this user
    supabase.from("algorithm_results").delete()
      .eq("user_id", userId).eq("algorithm_type", "xsimgcl")
      .catch(() => undefined);
  });
}

interface EventRecommendationsProps {
  bookedEvents: Event[];
  userId: string;
  limit?: number;
}

interface RecommendedEvent {
  eventId: string;
  score: number;
  rank: number;
  algorithm: string;
  reason?: string;
}

// Extends Event to carry the recommendation payload
interface EnrichedEvent extends Event {
  _recommendation?: RecommendedEvent;
}

export const EventRecommendations = memo(function EventRecommendations({
  userId,
  limit = 6,
}: EventRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<EnrichedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isColdStart, setIsColdStart] = useState(false);
  const [algorithm, setAlgorithm] = useState<string>("");

  const fetchRecommendations = useCallback(async () => {
    if (!userId) return;
    const reqStartTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      // Get auth token for the API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Please sign in to get recommendations.");
        return;
      }

      const excludeEventIds: string[] = [];

      const response = await fetch("/api/algorithms/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, limit, excludeEventIds }),
      });

      if (!response.ok) {
        throw new Error(`Recommendations API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error ?? "Unknown error");
      }

      const cold = data.coldStart ?? false;
      setIsColdStart(cold);
      setAlgorithm(data.algorithm ?? "");

      // Ensure minimum skeleton time of 400ms to prevent UI flashing
      const elapsed = Date.now() - reqStartTime;
      if (elapsed < 400) {
        await new Promise(r => setTimeout(r, 400 - elapsed));
      }

      const recPayloads = data.recommendations as RecommendedEvent[];
      
      // If we got 0 recs and coldStart is TRUE, fallback to trending events (UX-01)
      if (recPayloads.length === 0 && cold) {
        const { data: trending } = await supabase
          .from("events")
          .select("*")
          .eq("visibility_type", "public")
          .eq("event_status", "upcoming")
          .gte("start_date", new Date().toISOString())
          .order("attendee_count", { ascending: false })
          .limit(limit);
          
        setRecommendations((trending as EnrichedEvent[]) || []);
        return;
      } else if (recPayloads.length === 0) {
        setRecommendations([]);
        return;
      }

      // Fetch full event details for the recommended event IDs
      const recommendedIds = recPayloads
        .sort((a, b) => a.rank - b.rank)
        .map(r => r.eventId);

      const { data: events, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .in("id", recommendedIds);

      if (fetchError) throw new Error(fetchError.message);

      // Re-sort to match recommendation rank order and attach UX-07 `reason`
      const eventMap = new Map((events ?? []).map(e => [e.id, e]));
      const sorted = recPayloads
        .map(rec => {
          const e = eventMap.get(rec.eventId) as EnrichedEvent;
          if (e) e._recommendation = rec;
          return e;
        })
        .filter((e): e is EnrichedEvent => e !== undefined);

      setRecommendations(sorted);
    } catch {
      setError("Unable to load recommendations. Try again shortly.");
    } finally {
      setLoading(false);
    }
  // bookedEvents prop is intentionally excluded — it's not used inside this callback
  }, [userId, limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return (
    <div className="mb-6 p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              {isColdStart ? "New here? Trending Near You" : "Recommended For You"}
            </h3>
            {algorithm && (
              <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-widest font-semibold">
                {isColdStart ? "Trending · Getting started" : "XSimGCL · IEEE TKDE 2024"}
              </p>
            )}
          </div>
        </div>

        {!loading && recommendations.length > 0 && (
          <button
            onClick={fetchRecommendations}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition"
            title="Refresh recommendations"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <RecommendationCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-[var(--color-text-tertiary)] text-sm">{error}</p>
          <button
            onClick={fetchRecommendations}
            className="mt-2 text-[var(--color-brand)] hover:underline text-sm font-medium"
          >
            Try again
          </button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <Zap className="mx-auto text-[var(--color-brand)] opacity-20" size={32} />
          <p className="text-[var(--color-text-tertiary)] text-sm font-medium">
            {isColdStart
              ? "No upcoming events found right now. Check back soon!"
              : "We're still learning your preferences..."}
          </p>
          {!isColdStart && (
            <p className="text-[var(--color-text-tertiary)] text-[12px]">
              Attend or favorite more events to get personalized recommendations.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendations.map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.id}`}
              onClick={() => trackRecommendationClick(userId, event.id)}
              className="group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-background)] overflow-hidden hover:border-[var(--color-brand)] hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              {/* Banner */}
              <div className="relative aspect-video overflow-hidden bg-[var(--color-surface-hover)]">
                {event.event_banner_url ? (
                  <Image
                    src={event.event_banner_url}
                    alt={event.event_name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-brand)]/10 to-purple-500/10">
                    <Sparkles size={24} className="text-[var(--color-brand)] opacity-30" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text-primary)] line-clamp-1 group-hover:text-[var(--color-brand)] transition-colors">
                    {event.event_name}
                  </h4>
                  {event.start_date && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)] mt-1">
                      <Calendar size={11} />
                      <span>{new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  )}
                  {event.venue_city && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                      <MapPin size={11} />
                      <span className="truncate">{event.venue_city}</span>
                    </div>
                  )}
                </div>
                {/* UX-07 Explainability Pill */}
                {event._recommendation?.reason && (
                  <div className="text-[10px] text-[var(--color-text-tertiary)] pt-1 mt-1 border-t border-[var(--color-border)] italic">
                    {event._recommendation.reason}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
