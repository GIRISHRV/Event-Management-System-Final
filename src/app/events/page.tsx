"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, ArrowLeft, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/supabase-types";
import { useAuth } from "@/context/AuthContext";
import PillNav from "@/components/layout/PillNav";
import { EventSearchFilter } from "@/components/events/EventSearchFilter";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import Squares from "@/components/ui/Squares";

const EVENTS_PER_PAGE = 12;

export default function PublicEventsPage() {
  const { session, userProfile, signOut } = useAuth();
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

  // Fetch public events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("visibility_type", "public")
          .order("start_date", { ascending: true });

        if (error) throw error;

        const eventData = (data || []) as Event[];
        setEvents(eventData);

        // Extract unique locations
        const locations = [...new Set(eventData.map((e) => e.venue_city).filter(Boolean))] as string[];
        setUniqueLocations(locations);
      } catch (err) {
        console.error("[PublicEvents] Error fetching events:", err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Fetch favorites if logged in
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchFavorites = async () => {
      try {
        const { data, error } = await supabase
          .from("favorites")
          .select("event_id")
          .eq("user_id", session.user.id);

        if (error) throw error;
        setFavorites(new Set(data?.map((f) => f.event_id) || []));
      } catch (err) {
        console.error("[PublicEvents] Error fetching favorites:", err);
      }
    };

    fetchFavorites();
  }, [session?.user?.id]);

  // Toggle favorite
  const toggleFavorite = async (eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user?.id) {
      // Redirect to sign in
      window.location.href = "/signin";
      return;
    }

    setSavingFavorite(eventId);
    const isFavorited = favorites.has(eventId);

    try {
      if (isFavorited) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("event_id", eventId);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      } else {
        await supabase
          .from("favorites")
          .insert({ user_id: session.user.id, event_id: eventId });
        setFavorites((prev) => new Set(prev).add(eventId));
      }
    } catch (err) {
      console.error("[PublicEvents] Error toggling favorite:", err);
    } finally {
      setSavingFavorite(null);
    }
  };

  // Filter events
  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.event_description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const matchesLocation = locationFilter === "all" || event.venue_city === locationFilter;

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

  const displayedEvents = filteredEvents.slice(0, displayCount);
  const hasMore = displayCount < filteredEvents.length;

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + EVENTS_PER_PAGE, filteredEvents.length));
      setLoadingMore(false);
    }, 300);
  }, [filteredEvents.length]);

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = session
    ? [
        { label: "Home", href: "/" },
        { label: "Events", href: "/events" },
        {
          label: "Dashboard",
          href: userProfile?.role === "customer" ? "/customer-dashboard" : "/vendor-dashboard",
        },
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Events", href: "/events" },
        { label: "Sign In", href: "/signin" },
        { label: "Sign Up", href: "/signup" },
      ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <Squares
          direction="diagonal"
          speed={0.5}
          borderColor="rgba(34, 197, 94, 0.2)" // Green-500
          squareSize={60}
          hoverFillColor="rgba(34, 197, 94, 0.1)"
        />
      </div>

      {/* Navigation */}
      <div className="relative z-10">
        <PillNav
          items={navItems}
          activeHref="/events"
          userEmail={session?.user?.email}
          onSignOut={handleSignOut}
          showAuth={!!session}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-linear-to-r from-green-900/90 to-green-800/90 mt-20 backdrop-blur-sm border-y border-green-800/50">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-green-200 hover:text-white mb-4 transition active:scale-95"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2">
            Discover <span className="text-orange-300">Events</span>
          </h1>
          <p className="text-green-200 text-lg">
            Browse all public events and find something exciting to attend
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Search & Filters */}
        <EventSearchFilter
          onSearchChange={setSearchTerm}
          onLocationChange={setLocationFilter}
          onDateChange={setDateFilter}
          locations={uniqueLocations}
        />

        {/* Results Count */}
        <div className="mb-6 text-zinc-400">
          {loading ? (
            "Loading events..."
          ) : (
            <>
              Showing {displayedEvents.length} of {filteredEvents.length} events
            </>
          )}
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : displayedEvents.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/event/${event.id}`}
                  className="group relative bg-zinc-900 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-200 border border-zinc-700/50 hover:border-green-500/30 hover:-translate-y-1 block focus:outline-none focus:ring-2 focus:ring-green-500"
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

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => toggleFavorite(event.id, e)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition z-10"
                    title={session ? (favorites.has(event.id) ? "Remove from favorites" : "Add to favorites") : "Sign in to save favorites"}
                  >
                    {savingFavorite === event.id ? (
                      <Loader2 size={18} className="text-white animate-spin" />
                    ) : (
                      <Heart
                        size={18}
                        className={
                          favorites.has(event.id)
                            ? "text-red-500 fill-red-500"
                            : "text-white"
                        }
                      />
                    )}
                  </button>

                  {/* Date Badge */}
                  <div className="absolute top-4 left-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center shadow-lg">
                      <div className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
                        {event.start_date
                          ? new Date(event.start_date).toLocaleDateString("en", { month: "short" })
                          : "TBD"}
                      </div>
                      <div className="text-lg font-bold text-zinc-900 leading-none">
                        {event.start_date
                          ? new Date(event.start_date).toLocaleDateString("en", { day: "numeric" })
                          : "?"}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-5">
                    <h3 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-2">
                      {event.event_name}
                    </h3>
                    {event.venue_city && (
                      <div className="flex items-center gap-1.5 text-zinc-300 text-sm">
                        <MapPin size={14} />
                        <span>{event.venue_city}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>Load More Events</>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Calendar}
            title="No Events Found"
            description={
              searchTerm || locationFilter !== "all" || dateFilter !== "all"
                ? "Try adjusting your filters to find more events"
                : "There are no public events available at the moment. Check back soon!"
            }
          />
        )}
      </div>

      {/* CTA for non-authenticated users */}
      {!session && (
        <div className="bg-zinc-800 py-12 mt-8">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Want to save favorites or RSVP?</h2>
            <p className="text-zinc-400 mb-6">
              Create a free account to save your favorite events and register for them.
            </p>
            <Link
              href="/signup"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
