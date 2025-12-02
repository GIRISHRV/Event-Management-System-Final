"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Calendar, MapPin, Loader2, RefreshCw } from "lucide-react";
import type { Event } from "@/lib/supabase-types";

interface EventRecommendationsProps {
  bookedEvents: Event[];
  userId: string;
}

export function EventRecommendations({
  bookedEvents,
  userId,
}: EventRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Get categories/tags from booked events for recommendations
      const userInterests = bookedEvents
        .flatMap((e) => e.tags || [])
        .filter(Boolean);
      const userLocations = bookedEvents
        .map((e) => e.venue_city)
        .filter(Boolean);

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "event-recommendations",
          userId,
          interests: [...new Set(userInterests)],
          locations: [...new Set(userLocations)],
          bookedEventIds: bookedEvents.map((e) => e.id),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } else {
        throw new Error("Failed to fetch recommendations");
      }
    } catch {
      setError("Unable to load recommendations");
    } finally {
      setLoading(false);
    }
  }, [userId, bookedEvents]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return (
    <div className="mb-8 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-zinc-400" />
          <h3 className="text-lg font-semibold text-white">
            Events You Might Like
          </h3>
        </div>
        {!loading && recommendations.length > 0 && (
          <button
            onClick={fetchRecommendations}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Refresh recommendations"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
          <span className="ml-2 text-zinc-400">Finding events for you...</span>
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-zinc-400 text-sm">{error}</p>
          <button
            onClick={fetchRecommendations}
            className="mt-2 text-zinc-300 hover:text-white text-sm font-medium"
          >
            Try again
          </button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-zinc-400 text-sm">
            Attend more events to get personalized recommendations!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.slice(0, 3).map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.id}`}
              className="group bg-zinc-900/80 rounded-xl border border-zinc-700/50 hover:border-amber-500/30 overflow-hidden transition-all"
            >
              {/* Image */}
              <div className="relative h-28 bg-zinc-800">
                {event.event_banner_url ? (
                  <Image
                    src={event.event_banner_url}
                    alt={event.event_name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Calendar size={24} className="text-zinc-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
              </div>

              {/* Content */}
              <div className="p-4">
                <h4 className="font-medium text-white truncate group-hover:text-amber-400 transition-colors">
                  {event.event_name}
                </h4>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>
                      {new Date(event.start_date).toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {event.venue_city && (
                    <div className="flex items-center gap-1">
                      <MapPin size={12} />
                      <span>{event.venue_city}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
