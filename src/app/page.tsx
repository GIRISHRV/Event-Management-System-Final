"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import type { Event } from "@/lib/supabase-types";
import PillNav from "@/components/layout/PillNav";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { EventCountdown } from "@/components/ui/EventCountdown";

export default function Home() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Don't auto-redirect - let user choose to go to dashboard
  const handleGoToDashboard = () => {
    if (userProfile?.role === "customer") {
      router.push("/customer-dashboard");
    } else if (userProfile?.role === "vendor") {
      router.push("/vendor-dashboard");
    }
  };

  // Fetch public events from database
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select(`
            id,
            user_id,
            user_email,
            event_name,
            event_description,
            start_date,
            start_time,
            end_date,
            end_time,
            timezone,
            event_banner_url,
            visibility_type,
            event_status,
            created_at,
            updated_at
          `)
          .eq('visibility_type', 'public')
          .order("start_date", { ascending: true })
          .limit(3);

        if (error) {
          // console.error("Database error:", error);
          // Don't throw error - just show empty state
          setUpcomingEvents([]);
          setEventsLoading(false);
          return;
        }
        setUpcomingEvents((data || []) as Event[]);
      } catch {
        // console.error("Error fetching events:", err);
        setUpcomingEvents([]); // Set empty array on error
      } finally {
        setEventsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Show loading while checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = session 
    ? [
        { label: 'Home', href: '/' },
        { label: 'Dashboard', href: userProfile?.role === 'customer' ? '/customer-dashboard' : '/vendor-dashboard' }
      ]
    : [
        { label: 'Home', href: '/' },
        { label: 'Sign In', href: '/signin' },
        { label: 'Sign Up', href: '/signup' }
      ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navigation */}
      <PillNav
        items={navItems}
        activeHref="/"
        userEmail={session?.user?.email}
        onSignOut={handleSignOut}
        showAuth={!!session}
      />

      {/* Hero Section */}
      <div className="relative bg-linear-to-r from-green-900 to-green-800 overflow-hidden mt-20">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight animate-fade-in">
              Confidence In Every <span className="text-orange-300">Event</span>
            </h1>
            <p className="text-lg text-green-200 mb-12 max-w-2xl mx-auto animate-fade-in animation-delay-100">
              Discover and book the best events in your area. Connect with organizers and fellow event enthusiasts.
            </p>

            <div>
            {session && userProfile ? (
              <button
                onClick={handleGoToDashboard}
                className="px-8 py-3 bg-white text-green-800 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 mx-auto focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-800"
              >
                Go to Dashboard <ArrowRight size={18} />
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signin"
                  className="px-8 py-3 bg-white text-green-800 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-800"
                >
                  Sign In <ArrowRight size={18} />
                </Link>
                <Link
                  href="/signup"
                  className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-green-800 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-800"
                >
                  Create Account
                </Link>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Events Near You Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-4xl font-bold text-white">
            Events <span className="text-orange-400">Near You</span>
          </h2>
          <Link
            href={session ? "/customer-dashboard" : "/signin"}
            className="flex items-center gap-2 text-green-500 font-semibold hover:text-green-400 transition-all duration-200 hover:translate-x-1"
          >
            See all <ArrowRight size={20} />
          </Link>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {eventsLoading ? (
            // Loading skeleton
            <>
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </>
          ) : upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="event-card-home group relative bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-200 border border-zinc-700/50 hover:border-green-500/30 hover:-translate-y-1 cursor-pointer block focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
                style={{ aspectRatio: '3/4' }}
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
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgIBAwQDAAAAAAAAAAAAAQIDBBEABSEGEjFBUWFx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQADAQEBAAAAAAAAAAAAAAAAARESITH/2gAMAwEAAhEDEEEj/9oADAMBAAIRAxEAPwDYup+oLG6dR2IYkjjqxSukaRqACoOOT5J+zqjXv3I4Y0W5OqooUAOeABgf0opRaZGT/9k="
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
                        {event.start_date ? new Date(event.start_date).toLocaleDateString('en', { month: 'short' }) : 'TBD'}
                      </div>
                      <div className="text-lg font-bold text-zinc-900 leading-none">
                        {event.start_date ? new Date(event.start_date).toLocaleDateString('en', { day: 'numeric' }) : '?'}
                      </div>
                    </div>
                  </div>

                  {/* Event Info */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white leading-tight">
                      {event.event_name}
                    </h3>
                    {/* Countdown */}
                    {event.start_date && (
                      <EventCountdown
                        startDate={event.start_date}
                        startTime={event.start_time}
                        compact
                      />
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-1 md:col-span-3 text-center py-12">
              <Calendar size={64} className="mx-auto text-zinc-500 mb-4" />
              <h3 className="text-xl font-semibold text-zinc-400 mb-2">No Public Events Yet</h3>
              <p className="text-zinc-500">
                {session 
                  ? "Check back soon for upcoming events, or create your own!"
                  : "Sign in to discover more events and create your own!"
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CTA Section */}
      {!session && (
        <div className="bg-zinc-800 py-16">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Ready to discover events?</h2>
            <p className="text-lg text-zinc-400 mb-8">
              Join thousands of people finding and creating amazing events.
            </p>
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 hover:scale-105 text-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-zinc-800"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
