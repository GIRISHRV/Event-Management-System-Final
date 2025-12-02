"use client";

import { useState, useEffect, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Calendar, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/supabase-types";

interface RecentlyViewedProps {
  userId: string;
  maxItems?: number;
}

export const RecentlyViewed = memo(function RecentlyViewed({ userId, maxItems = 5 }: RecentlyViewedProps) {
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentlyViewed = async () => {
      if (!userId) return;

      try {
        // First get the recently viewed event IDs
        const { data: recentData, error: recentError } = await supabase
          .from("recently_viewed")
          .select("event_id")
          .eq("user_id", userId)
          .order("viewed_at", { ascending: false })
          .limit(maxItems);

        if (recentError) throw recentError;

        if (!recentData || recentData.length === 0) {
          setRecentEvents([]);
          setLoading(false);
          return;
        }

        // Then fetch the events
        const eventIds = recentData.map((r) => r.event_id);
        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .in("id", eventIds);

        if (eventsError) throw eventsError;

        // Sort by the original recently viewed order
        const orderedEvents = eventIds
          .map((id) => eventsData?.find((e) => e.id === id))
          .filter((e): e is Event => e !== null && e !== undefined);

        setRecentEvents(orderedEvents);
      } catch {
        // Failed to fetch - show empty state
        setRecentEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentlyViewed();
  }, [userId, maxItems]);

  return (
    <div className="mb-8 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-zinc-400" />
          <h3 className="text-lg font-semibold text-white">Recently Viewed</h3>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-64 h-24 rounded-xl bg-zinc-800/60 animate-pulse"
            />
          ))}
        </div>
      ) : recentEvents.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-zinc-400 text-sm">No recently viewed events yet. Start exploring!</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {recentEvents.map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.id}`}
              className="group shrink-0 w-64 bg-zinc-900/80 rounded-xl border border-zinc-700/50 hover:border-cyan-500/30 overflow-hidden transition-all"
            >
              <div className="flex gap-3 p-3">
                {/* Thumbnail */}
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 relative">
                  {event.event_banner_url ? (
                    <Image
                      src={event.event_banner_url}
                      alt={event.event_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar size={20} className="text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate group-hover:text-cyan-400 transition-colors">
                    {event.event_name}
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    {new Date(event.start_date).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight
                  size={16}
                  className="shrink-0 text-zinc-600 group-hover:text-cyan-400 transition-colors self-center"
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});

// Helper function to track recently viewed events
export async function trackRecentlyViewed(
  userId: string,
  eventId: string
): Promise<void> {
  try {
    // Upsert to update viewed_at if already exists
    await supabase.from("recently_viewed").upsert(
      {
        user_id: userId,
        event_id: eventId,
        viewed_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,event_id",
      }
    );

    // Clean up old entries (keep only last 20)
    const { data: oldEntries } = await supabase
      .from("recently_viewed")
      .select("id")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .range(20, 100);

    if (oldEntries && oldEntries.length > 0) {
      await supabase
        .from("recently_viewed")
        .delete()
        .in(
          "id",
          oldEntries.map((e) => e.id)
        );
    }
  } catch {
    // Silently fail tracking - non-critical feature
  }
}
