"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import type { Event } from "@/lib/supabase-types";

interface UpcomingEventBannerProps {
  event: Event | null;
}

export function UpcomingEventBanner({ event }: UpcomingEventBannerProps) {
  if (!event) return null;

  const eventDate = new Date(event.start_date);
  const today = new Date();
  const daysUntil = Math.ceil(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const getDaysUntilText = () => {
    if (daysUntil === 0) return "Today!";
    if (daysUntil === 1) return "Tomorrow";
    if (daysUntil <= 7) return `In ${daysUntil} days`;
    return eventDate.toLocaleDateString("en", { month: "short", day: "numeric" });
  };

  return (
    <Link
      href={`/event/${event.id}`}
      className="group block mb-8 relative overflow-hidden rounded-2xl border border-green-500/30 bg-linear-to-r from-zinc-900/90 via-zinc-800/90 to-zinc-900/90 backdrop-blur-md hover:border-green-500/50 transition-all"
    >
      {/* Background Image (if exists) */}
      {event.event_banner_url && (
        <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
          <Image
            src={event.event_banner_url}
            alt=""
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-r from-zinc-900 via-zinc-900/80 to-transparent" />
        </div>
      )}

      <div className="relative p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Date Badge */}
        <div className="shrink-0 px-4 py-3 bg-green-600 rounded-xl text-center min-w-20">
          <div className="text-xs font-bold text-green-100 uppercase tracking-wide">
            {eventDate.toLocaleDateString("en", { month: "short" })}
          </div>
          <div className="text-2xl font-bold text-white leading-none">
            {eventDate.toLocaleDateString("en", { day: "numeric" })}
          </div>
        </div>

        {/* Event Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
              {getDaysUntilText()}
            </span>
            <span className="text-xs text-zinc-500">Your next event</span>
          </div>
          <h3 className="text-xl font-bold text-white truncate group-hover:text-green-400 transition-colors">
            {event.event_name}
          </h3>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-zinc-400">
            {event.start_time && (
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{event.start_time}</span>
              </div>
            )}
            {event.venue_city && (
              <div className="flex items-center gap-1">
                <MapPin size={14} />
                <span>{event.venue_city}</span>
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="shrink-0 p-3 rounded-full bg-zinc-800 group-hover:bg-green-600 transition-colors">
          <ArrowRight
            size={20}
            className="text-zinc-400 group-hover:text-white transition-colors"
          />
        </div>
      </div>
    </Link>
  );
}
