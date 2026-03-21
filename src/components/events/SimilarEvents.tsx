// src/components/events/SimilarEvents.tsx
// Shows events from the same GAT+K-Means community as the current event.
// Falls back to tag-based similarity when the community cache is cold.
// Drops into the right sidebar of event/[id]/page.tsx.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/services/supabase/client";

interface SimilarEvent {
  id: string;
  event_name: string;
  start_date: string;
  venue_name: string | null;
  event_banner_url: string | null;
}

interface Props {
  eventId: string;
}

export function SimilarEvents({ eventId }: Props) {
  const [events, setEvents] = useState<SimilarEvent[]>([]);
  const [communityLabel, setCommunityLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTagFallback, setIsTagFallback] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    async function load() {
      try {
        setLoading(true);
        setIsTagFallback(false);

        // 1. Get similar event IDs from communities API
        const res = await fetch(
          `/api/algorithms/communities?eventId=${eventId}`
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data.success && data.similarEventIds?.length) {
          // ── Community hit ─────────────────────────────────────────────────
          setCommunityLabel(data.community?.label ?? null);

          const { data: eventRows } = await supabase
            .from("events")
            .select("id, event_name, start_date, venue_name, event_banner_url")
            .in("id", data.similarEventIds)
            .eq("visibility_type", "public")
            .limit(4);

          setEvents(eventRows ?? []);
        } else {
          // ── Tag-based fallback (community cache is cold) ──────────────────
          const { data: currentEvent } = await supabase
            .from("events")
            .select("tags")
            .eq("id", eventId)
            .single();

          const tags: string[] = Array.isArray(currentEvent?.tags)
            ? currentEvent.tags
            : [];

          if (tags.length > 0) {
            const { data: taggedEvents } = await supabase
              .from("events")
              .select("id, event_name, start_date, venue_name, event_banner_url")
              .eq("visibility_type", "public")
              .neq("id", eventId)
              .overlaps("tags", tags)
              .limit(4);

            if (taggedEvents && taggedEvents.length > 0) {
              setEvents(taggedEvents);
              setIsTagFallback(true);
            }
          }
        }
      } catch {
        // Silently fail — similar events are non-critical
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [eventId]);

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-[var(--color-surface-hover)] rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-[var(--color-surface-hover)] rounded-xl" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-[var(--color-text-tertiary)] opacity-40" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">
            Similar Events
          </p>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
          Communities haven&apos;t been computed yet. Check back after the admin runs community detection.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--color-brand)]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">
            {isTagFallback ? "You Might Also Like" : "Similar Events"}
          </p>
          {communityLabel && !isTagFallback && (
            <p className="text-xs text-[var(--color-brand)] font-semibold">
              {communityLabel}
            </p>
          )}
          {isTagFallback && (
            <p className="text-[10px] text-[var(--color-text-tertiary)] opacity-60">
              Personalized communities update daily
            </p>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/event/${e.id}`}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors group"
          >
            {/* Colour strip avatar */}
            <div
              className="w-9 h-9 rounded-lg flex-shrink-0 bg-gradient-to-br from-[var(--color-brand)]/20 to-purple-500/20 border border-[var(--color-border)] flex items-center justify-center text-[10px] font-black text-[var(--color-brand)] uppercase"
            >
              {e.event_name.slice(0, 2)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-brand)] transition-colors">
                {e.event_name}
              </p>
              <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                {e.venue_name ?? "Online"} ·{" "}
                {new Date(e.start_date).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            <ArrowRight
              size={14}
              className="flex-shrink-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-brand)] group-hover:translate-x-0.5 transition-all"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
