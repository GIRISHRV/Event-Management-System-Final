"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import type { EventRow } from "@/schemas/event.schema";

interface UpcomingEventBannerProps {
  event: EventRow | null;
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
      className="group block mb-6 relative overflow-hidden rounded-xl border border-[var(--color-brand)]/30 bg-gradient-to-r from-[var(--color-surface)]/90 via-[var(--color-background)]/90 to-[var(--color-surface)]/90 backdrop-blur-md hover:border-[var(--color-brand)]/50 transition-all"
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
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface)]/80 to-transparent" />
        </div>
      )}

      <div className="relative p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Date Badge */}
        <div className="shrink-0 px-3 py-2 bg-[var(--color-brand)] rounded-lg text-center min-w-16">
          <div className="text-xs font-bold text-white uppercase tracking-wide">
            {eventDate.toLocaleDateString("en", { month: "short" })}
          </div>
          <div className="text-xl font-bold text-white leading-none">
            {eventDate.toLocaleDateString("en", { day: "numeric" })}
          </div>
        </div>

        {/* Event Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-brand)]/20 text-[var(--color-brand)] rounded-full">
              {getDaysUntilText()}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Your next event</span>
          </div>
          <h3 className="text-lg font-bold text-white truncate group-hover:text-[var(--color-brand)] transition-colors">
            {event.event_name}
          </h3>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[var(--color-text-tertiary)]">
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
        <div className="shrink-0 p-2 rounded-full bg-[var(--color-surface)] group-hover:bg-[var(--color-brand)] transition-colors">
          <ArrowRight
            size={18}
            className="text-[var(--color-text-tertiary)] group-hover:text-white transition-colors"
          />
        </div>
      </div>
    </Link>
  );
}
