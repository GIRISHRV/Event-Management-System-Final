"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Globe, Calendar } from "lucide-react";
import { getPublicEvents } from "@/lib/events";
import type { EventWithAttendeeInfo } from "@/lib/supabase-types";

interface PublicEventListProps {
  currentUserId: string;
}

export function PublicEventList({ currentUserId }: PublicEventListProps) {
  const [events, setEvents] = useState<EventWithAttendeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getPublicEvents();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching public events:", error);
      console.log("ℹ️ Public events require database migration - showing empty list for now");
      setEvents([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event =>
    event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.event_description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-zinc-400">Loading public events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 transition backdrop-blur-md"
          />
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="p-8 text-center border border-zinc-700/50 rounded-xl bg-zinc-900/60 backdrop-blur-md shadow-lg">
          <Globe size={48} className="mx-auto mb-4 text-zinc-400" />
          <p className="text-zinc-400 text-lg">
            {searchTerm ? "No events match your search" : "No public events available"}
          </p>
          <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2">
            {searchTerm ? "Try a different search term" : "Check back later for new events!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
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
                      {new Date(event.start_date).toLocaleDateString('en', { month: 'short' })}
                    </div>
                    <div className="text-lg font-bold text-zinc-900 leading-none">
                      {new Date(event.start_date).toLocaleDateString('en', { day: 'numeric' })}
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
      )}
    </div>
  );
}