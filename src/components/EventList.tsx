"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar } from "lucide-react";
import type { Event } from "@/lib/supabase-types";

interface EventListProps {
  events: Event[];
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => void;
  isLoading?: boolean;
  currentUserId?: string;
  showActions?: boolean;
}

export function EventList({
  events,
  onEdit,
  onDelete,
  isLoading = false,
  currentUserId,
  showActions = true,
}: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="p-12 text-center border border-zinc-700/50 rounded-2xl bg-zinc-900/60 backdrop-blur-md shadow-lg">
        <Calendar size={64} className="mx-auto mb-4 text-zinc-400" />
        <p className="text-zinc-400 text-xl font-semibold">No events created yet</p>
        <p className="text-zinc-500 text-sm mt-2">
          Create your first event to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/event/${event.id}`}
          className="group relative bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 border border-zinc-700/50 hover:border-green-500/30 cursor-pointer block"
          style={{ aspectRatio: '3/4' }}
        >
          {/* Background Image */}
          <div className="absolute inset-0">
            {event.event_banner_url ? (
              <Image
                src={event.event_banner_url}
                alt={event.event_name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
                <Calendar size={48} className="text-zinc-600" />
              </div>
            )}
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-6">
            {/* Date Badge */}
            <div className="absolute top-6 right-6">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center shadow-lg">
                <div className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
                  {event.start_date ? new Date(event.start_date).toLocaleDateString('en', { month: 'short' }) : 'TBD'}
                </div>
                <div className="text-lg font-bold text-zinc-900 leading-none">
                  {event.start_date ? new Date(event.start_date).toLocaleDateString('en', { day: 'numeric' }) : '?'}
                </div>
              </div>
            </div>

            {/* Event Info */}
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-white leading-tight">
                {event.event_name}
              </h3>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
