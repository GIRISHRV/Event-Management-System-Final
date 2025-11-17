"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, LogOut, Calendar } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import type { Event } from "@/lib/supabase-types";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);

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
          .select("*")
          .order("start_date", { ascending: true })
          .limit(3);

        if (error) {
          console.error("Database error:", error);
          throw error;
        }
        setUpcomingEvents(data || []);
      } catch (err) {
        console.error("Error fetching events:", err);
      }
    };

    fetchEvents();
  }, []);

  // Show loading while checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-gray-800 dark:text-white">Loading...</p>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <button
          onClick={() => router.push("/")}
          className="text-2xl font-bold text-green-700 dark:text-green-500 hover:text-green-800 dark:hover:text-green-400 transition"
        >
          EMS (WIP)
        </button>
        <div className="flex gap-4 items-center">
          {session ? (
            <>
              <div className="text-gray-700 dark:text-gray-300 text-sm flex items-center">
                Welcome, <span className="font-medium ml-1">{session.user.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition flex items-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition font-medium"
              >
                FIND EVENTS
              </Link>
              <Link
                href="/signup"
                className="px-6 py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition"
              >
                LOGIN
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-linear-to-r from-green-800 to-green-700 dark:from-green-900 dark:to-green-800 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              Confidence In Every <span className="text-orange-400 dark:text-orange-300">Event</span>
            </h1>
            <p className="text-lg text-green-100 dark:text-green-200 mb-12 max-w-2xl mx-auto">
              Discover and book the best events in your area. Connect with organizers and fellow event enthusiasts.
            </p>

            {session && userProfile ? (
              <button
                onClick={handleGoToDashboard}
                className="px-8 py-3 bg-white dark:bg-gray-200 text-green-700 dark:text-green-800 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-300 transition flex items-center gap-2 mx-auto"
              >
                Go to Dashboard <ArrowRight size={18} />
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signin"
                  className="px-8 py-3 bg-white dark:bg-gray-200 text-green-700 dark:text-green-800 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-300 transition flex items-center justify-center gap-2"
                >
                  Sign In <ArrowRight size={18} />
                </Link>
                <Link
                  href="/signup"
                  className="px-8 py-3 border-2 border-white dark:border-gray-300 text-white dark:text-gray-200 rounded-lg font-semibold hover:bg-white hover:text-green-700 dark:hover:bg-gray-200 dark:hover:text-green-800 transition"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Events Near You Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
            Events <span className="text-orange-500 dark:text-orange-400">Near You</span>
          </h2>
          <Link
            href={session ? "/customer-dashboard" : "/signin"}
            className="flex items-center gap-2 text-green-700 dark:text-green-500 font-semibold hover:text-green-800 dark:hover:text-green-400 transition"
          >
            See all <ArrowRight size={20} />
          </Link>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {upcomingEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition border border-gray-200 dark:border-zinc-700"
            >
              {/* Event Image */}
              <div className="relative h-48 overflow-hidden bg-gray-200 dark:bg-zinc-700">
                {event.event_banner_url ? (
                  <Image
                    src={event.event_banner_url}
                    alt={event.event_name}
                    width={400}
                    height={300}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-zinc-600 text-gray-600 dark:text-gray-400">
                    No Image
                  </div>
                )}
              </div>

              {/* Event Details */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{event.event_name}</h3>

                <div className="space-y-2 mb-6">
                  {event.event_description && (
                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <p>{event.event_description.substring(0, 100)}...</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Calendar size={16} className="text-green-700 dark:text-green-500" />
                    <span>{new Date(event.start_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <button className="w-full py-2 bg-green-700 dark:bg-green-600 text-white rounded-lg font-semibold hover:bg-green-800 dark:hover:bg-green-700 transition">
                  VIEW EVENT →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      {!session && (
        <div className="bg-gray-100 dark:bg-zinc-800 py-16">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Ready to discover events?</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              Join thousands of people finding and creating amazing events.
            </p>
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-green-700 dark:bg-green-600 text-white rounded-lg font-semibold hover:bg-green-800 dark:hover:bg-green-700 transition text-lg"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
