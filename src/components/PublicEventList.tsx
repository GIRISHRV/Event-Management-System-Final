"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Globe, Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { getPublicEvents } from "@/lib/events";
import type { EventWithAttendeeInfo } from "@/lib/supabase-types";

interface PublicEventListProps {
  // No props needed currently
}

const EVENTS_PER_PAGE = 9;

export function PublicEventList({}: PublicEventListProps) {
  const [events, setEvents] = useState<EventWithAttendeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Extract unique locations for filter
  useEffect(() => {
    if (events.length > 0) {
      const locations = Array.from(
        new Set(events.map(e => e.venue_city).filter(Boolean))
      ).sort();
      setUniqueLocations(locations as string[]);
    }
  }, [events]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getPublicEvents();
      setEvents(data);
      setCurrentPage(1); // Reset pagination
    } catch (error) {
      console.error("Error fetching public events:", error);
      console.log("ℹ️ Public events require database migration - showing empty list for now");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter events
  let filteredEvents = events.filter(event => {
    // Search filter
    const matchesSearch =
      event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.event_description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    // Location filter
    const matchesLocation = locationFilter === "all" || event.venue_city === locationFilter;

    // Date filter
    let matchesDate = true;
    if (dateFilter !== "all") {
      const eventDate = new Date(event.start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === "upcoming") {
        matchesDate = eventDate >= today;
      } else if (dateFilter === "this-week") {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        matchesDate = eventDate >= today && eventDate <= weekEnd;
      } else if (dateFilter === "this-month") {
        matchesDate =
          eventDate.getMonth() === today.getMonth() &&
          eventDate.getFullYear() === today.getFullYear();
      }
    }

    return matchesSearch && matchesLocation && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-zinc-400">Loading public events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search events by name or description..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 transition backdrop-blur-md"
        />

        {/* Filter Row */}
        <div className="flex gap-4 flex-wrap">
          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:border-green-500 transition text-sm"
          >
            <option value="all">All Locations</option>
            {uniqueLocations.map(location => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:border-green-500 transition text-sm"
          >
            <option value="all">All Dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="p-8 text-center border border-zinc-700/50 rounded-xl bg-zinc-900/60 backdrop-blur-md shadow-lg">
          <Globe size={48} className="mx-auto mb-4 text-zinc-400" />
          <p className="text-zinc-400 text-lg">
            {searchTerm || locationFilter !== "all" || dateFilter !== "all"
              ? "No events match your filters"
              : "No public events available"}
          </p>
          <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2">
            {searchTerm || locationFilter !== "all" || dateFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Check back later for new events!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedEvents.map((event) => (
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
                    <div className="w-full h-full bg-linear-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
                      <Calendar size={48} className="text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />

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
                    {event.venue_city && (
                      <div className="flex items-center gap-2 text-sm text-zinc-200">
                        <MapPin size={16} />
                        <span>{event.venue_city}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-zinc-700/50 text-white hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="text-sm text-zinc-400">
                Page {currentPage} of {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-zinc-700/50 text-white hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}