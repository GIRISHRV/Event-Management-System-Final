"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Share2, Edit, Trash2, MoreHorizontal, X } from "lucide-react";
import type { Event } from "@/lib/supabase-types";
import { EventCardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventSearchFilter } from "./EventSearchFilter";

interface EventListWithActionsProps {
  events: Event[];
  isLoading?: boolean;
  showSearch?: boolean;
  showQuickActions?: boolean;
  type?: "my-events" | "attending";
  onEdit?: (event: Event) => void;
  onDelete?: (eventId: string) => void;
  onCreateNew?: () => void;
  onDiscoverEvents?: () => void;
}

export function EventListWithActions({
  events,
  isLoading = false,
  showSearch = true,
  showQuickActions = true,
  type = "my-events",
  onEdit,
  onDelete,
  onCreateNew,
  onDiscoverEvents,
}: EventListWithActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Extract unique locations
  const locations = useMemo(() => {
    return [...new Set(events.map((e) => e.venue_city).filter(Boolean))] as string[];
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.event_description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      // Location filter
      const matchesLocation =
        locationFilter === "all" || event.venue_city === locationFilter;

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
        } else if (dateFilter === "past") {
          matchesDate = eventDate < today;
        }
      }

      return matchesSearch && matchesLocation && matchesDate;
    });
  }, [events, searchTerm, locationFilter, dateFilter]);

  const hasFilters = !!(searchTerm || locationFilter !== "all" || dateFilter !== "all");

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setLocationFilter("all");
    setDateFilter("all");
  }, []);

  const handleShare = useCallback(async (event: Event, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = `${window.location.origin}/event/${event.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.event_name,
          text: event.event_description || "Check out this event!",
          url,
        });
      } catch (err) {
        // User cancelled or share API not available
        console.log('[EventListWithActions] Share cancelled:', err);
      }
    } else {
      await navigator.clipboard.writeText(url);
      // You could add a toast here
    }
    setActiveMenu(null);
  }, []);

  const handleEdit = useCallback((event: Event, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(event);
    setActiveMenu(null);
  }, [onEdit]);

  const handleDelete = useCallback((eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this event?")) {
      onDelete?.(eventId);
    }
    setActiveMenu(null);
  }, [onDelete]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {showSearch && (
          <div className="space-y-4">
            <Skeleton className="w-full h-12 rounded-xl" />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      {showSearch && events.length > 0 && (
        <EventSearchFilter
          onSearchChange={setSearchTerm}
          onLocationChange={setLocationFilter}
          onDateChange={setDateFilter}
          locations={locations}
        />
      )}

      {/* Empty State */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          type={type}
          filtered={hasFilters}
          onAction={hasFilters ? clearFilters : type === "my-events" ? onCreateNew : onDiscoverEvents}
        />
      ) : (
        <div
          ref={containerRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredEvents.map((event) => (
            <div key={event.id} className="relative group">
              <Link
                href={`/event/${event.id}`}
                className="event-card-enhanced relative bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 border border-zinc-700/50 hover:border-primary/30 cursor-pointer block"
                style={{ aspectRatio: "3/4" }}
              >
                {/* Background Image */}
                <div className="absolute inset-0">
                  {event.event_banner_url ? (
                    <Image
                      src={event.event_banner_url}
                      alt={event.event_name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
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
                    <div className="bg-zinc-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center shadow-lg border border-zinc-700/50">
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                        {event.start_date
                          ? new Date(event.start_date).toLocaleDateString("en", {
                              month: "short",
                            })
                          : "TBD"}
                      </div>
                      <div className="text-lg font-bold text-white leading-none">
                        {event.start_date
                          ? new Date(event.start_date).toLocaleDateString("en", {
                              day: "numeric",
                            })
                          : "?"}
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

              {/* Quick Actions Menu */}
              {showQuickActions && (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveMenu(activeMenu === event.id ? null : event.id);
                    }}
                    className="absolute top-6 left-6 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {/* Action Menu Dropdown */}
                  {activeMenu === event.id && (
                    <div
                      className="absolute top-16 left-6 bg-zinc-900 rounded-xl border border-zinc-700 shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleShare(event, e)}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                      >
                        <Share2 size={16} />
                        Share Event
                      </button>
                      {type === "my-events" && onEdit && (
                        <button
                          onClick={(e) => handleEdit(event, e)}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                        >
                          <Edit size={16} />
                          Edit Event
                        </button>
                      )}
                      {type === "my-events" && onDelete && (
                        <button
                          onClick={(e) => handleDelete(event.id, e)}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm text-destructive hover:bg-zinc-800 hover:text-destructive/80 transition"
                        >
                          <Trash2 size={16} />
                          Delete Event
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveMenu(null);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition border-t border-zinc-800"
                      >
                        <X size={16} />
                        Close
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Close menu when clicking outside */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  );
}
