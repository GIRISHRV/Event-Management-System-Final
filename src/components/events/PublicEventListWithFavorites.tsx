"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Heart,
  Share2,
  Loader2,
} from "lucide-react";
import { getPublicEvents } from "@/lib/events";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/supabase-types";
import { EventCardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface PublicEventListWithFavoritesProps {
  userId?: string;
  onDiscoverMore?: () => void;
}

const EVENTS_PER_PAGE = 9;

export function PublicEventListWithFavorites({
  userId,
  onDiscoverMore,
}: PublicEventListWithFavoritesProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [displayCount, setDisplayCount] = useState(EVENTS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [savingFavorite, setSavingFavorite] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch favorites
  useEffect(() => {
    if (!userId) return;

    const fetchFavorites = async () => {
      try {
        const { data, error } = await supabase
          .from("favorites")
          .select("event_id")
          .eq("user_id", userId);

        if (error) throw error;
        setFavorites(new Set(data?.map((f) => f.event_id) || []));
      } catch (err) {
        console.error('[PublicEventList] Error fetching favorites:', err);
        // Favorites are non-critical - continue without them
      }
    };

    fetchFavorites();
  }, [userId]);

  // Infinite scroll observer
  useEffect(() => {
    const currentFilteredLength = events.filter((event) => {
      const matchesSearch =
        event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.event_description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesLocation = locationFilter === "all" || event.venue_city === locationFilter;
      let matchesDate = true;
      if (dateFilter !== "all") {
        const eventDate = new Date(event.start_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateFilter === "upcoming") matchesDate = eventDate >= today;
        else if (dateFilter === "this-week") {
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          matchesDate = eventDate >= today && eventDate <= weekEnd;
        } else if (dateFilter === "this-month") {
          matchesDate = eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear();
        }
      }
      return matchesSearch && matchesLocation && matchesDate;
    }).length;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && displayCount < currentFilteredLength) {
          setLoadingMore(true);
          setTimeout(() => {
            setDisplayCount(prev => Math.min(prev + EVENTS_PER_PAGE, currentFilteredLength));
            setLoadingMore(false);
          }, 300);
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadingMore, displayCount, events, searchTerm, locationFilter, dateFilter]);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Extract unique locations for filter
  useEffect(() => {
    if (events.length > 0) {
      const locations = Array.from(
        new Set(events.map((e) => e.venue_city).filter(Boolean))
      ).sort();
      setUniqueLocations(locations as string[]);
    }
  }, [events]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getPublicEvents();
      setEvents(data);
    } catch (err) {
      console.error('[PublicEventList] Error fetching events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = useCallback(
    async (eventId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!userId) return;

      setSavingFavorite(eventId);
      try {
        if (favorites.has(eventId)) {
          // Remove from favorites
          await supabase
            .from("favorites")
            .delete()
            .eq("user_id", userId)
            .eq("event_id", eventId);

          setFavorites((prev) => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
        } else {
          // Add to favorites
          await supabase.from("favorites").insert({
            user_id: userId,
            event_id: eventId,
          });

          setFavorites((prev) => new Set(prev).add(eventId));
        }
      } catch (err) {
        console.error('[PublicEventList] Error toggling favorite:', err);
        // Will show stale state but recover on refresh
      } finally {
        setSavingFavorite(null);
      }
    },
    [userId, favorites]
  );

  const handleShare = useCallback(
    async (event: Event, e: React.MouseEvent) => {
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
          // User cancelled or share failed - not an error
          console.log('[PublicEventList] Share cancelled or failed:', err);
        }
      } else {
        await navigator.clipboard.writeText(url);
      }
    },
    []
  );

  // Filter events
  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.event_description?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false);

    const matchesLocation =
      locationFilter === "all" || event.venue_city === locationFilter;

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

  const hasFilters = !!(searchTerm || locationFilter !== "all" || dateFilter !== "all");

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(EVENTS_PER_PAGE);
  }, [searchTerm, locationFilter, dateFilter]);

  // Infinite scroll - show events up to displayCount
  const displayedEvents = filteredEvents.slice(0, displayCount);
  const hasMore = displayCount < filteredEvents.length;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Search Skeleton */}
        <div className="space-y-4">
          <Skeleton className="w-full h-10 rounded-lg" />
          <div className="flex gap-4">
            <Skeleton className="w-32 h-10 rounded-lg" />
            <Skeleton className="w-32 h-10 rounded-lg" />
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Search & Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search events by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition backdrop-blur-md"
        />

        {/* Filter Row */}
        <div className="flex gap-4 flex-wrap">
          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
            }}
            className="px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:border-primary transition text-sm"
          >
            <option value="all">All Locations</option>
            {uniqueLocations.map((location) => (
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
            }}
            className="px-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:border-primary transition text-sm"
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
        <EmptyState
          type="discover"
          filtered={hasFilters}
          onAction={
            hasFilters
              ? () => {
                  setSearchTerm("");
                  setLocationFilter("all");
                  setDateFilter("all");
                }
              : onDiscoverMore
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedEvents.map((event) => (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="public-event-card-fav group relative bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 border border-zinc-700/50 hover:border-primary/30 cursor-pointer block"
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
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMDBAMBAAAAAAAAAAAAAQIDBAAFEQYSITEHE0FR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwEAAhEDEEEEBAyDzzg="
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
                      <Calendar size={48} className="text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />

                {/* Action Buttons (Top Left) */}
                <div className="absolute top-6 left-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {userId && (
                    <button
                      onClick={(e) => toggleFavorite(event.id, e)}
                      disabled={savingFavorite === event.id}
                      className={`p-2 rounded-full backdrop-blur-sm transition focus:outline-none focus:ring-2 focus:ring-primary ${
                        favorites.has(event.id)
                          ? "bg-rose-500 text-white"
                          : "bg-black/50 text-white hover:bg-black/70"
                      }`}
                    >
                      <Heart
                        size={18}
                        className={favorites.has(event.id) ? "fill-current" : ""}
                      />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleShare(event, e)}
                    className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <Share2 size={18} />
                  </button>
                </div>

                {/* Date Badge (Top Right) */}
                <div className="absolute top-6 right-6">
                  <div className="bg-zinc-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center shadow-lg border border-zinc-700/50">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                      {new Date(event.start_date).toLocaleDateString("en", {
                        month: "short",
                      })}
                    </div>
                    <div className="text-lg font-bold text-white leading-none">
                      {new Date(event.start_date).toLocaleDateString("en", {
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-6">
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

          {/* Infinite Scroll Trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex items-center justify-center py-8">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span>Loading more events...</span>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  Scroll for more • {displayedEvents.length} of {filteredEvents.length} events
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
