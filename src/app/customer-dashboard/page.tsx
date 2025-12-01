"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { LogOut, Plus, Calendar, Globe, Loader2, Ticket } from "lucide-react";
import { EnhancedEventForm } from "@/components/EnhancedEventForm";
import { EventList } from "@/components/EventList";
import { PublicEventList } from "@/components/PublicEventList";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Event, CreateEventInput } from "@/lib/supabase-types";
import { logError, getErrorMessage } from "@/lib/error-handler";
import Squares from "@/components/Squares";
import PillNav from "@/components/PillNav";
import { useToast } from "@/components/Toast";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();
  const { error: toastError, success: toastSuccess, Toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [bookedEvents, setBookedEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [bookedEventsLoading, setBookedEventsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-events' | 'attending' | 'discover'>('my-events');

  // Protect route - redirect if not customer
  // Only redirect if: loading is done AND (no session OR not a customer)
  useEffect(() => {
    if (!loading) {
      // Wait for profile to load - don't redirect until we know the role
      if (!session) {
        router.push("/signin");
      } else if (userProfile && userProfile.role !== "customer") {
        router.push("/vendor-dashboard");
      }
      // If session exists but userProfile is null, wait for profile to load
    }
  }, [session, userProfile, loading, router]);

  const fetchEvents = async () => {
    if (!session?.user) return;

    setEventsLoading(true);
    try {
      // Query with available columns from database schema
      const { data, error } = await supabase
        .from("events")
        .select(`
          id, user_id, user_email, event_name, event_description, 
          start_date, start_time, end_date, end_time, timezone, 
          event_banner_url, visibility_type, event_status, 
          max_attendees,
          venue_name, venue_address, venue_city, venue_landmark, 
          venue_type, google_maps_url,
          organizer_name, organizer_contact,
          organizer_email,
          schedules, performers, faqs,
          gallery_images, gallery_videos, tags,
          created_at, updated_at
        `)
        .eq("user_email", session.user.email)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error details:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        throw error;
      }
      
      // Ensure all fields have proper defaults
      const eventsWithDefaults = (data || []).map(event => ({
        ...event,
        visibility_type: event.visibility_type || 'public',
        event_status: event.event_status || 'upcoming',
        max_attendees: event.max_attendees || undefined,
        schedules: event.schedules || [],
        performers: event.performers || [],
        faqs: event.faqs || [],
        gallery_images: event.gallery_images || [],
        gallery_videos: event.gallery_videos || [],
        tags: event.tags || [],
      })) as Event[];
      
      setEvents(eventsWithDefaults);
      
    } catch (err) {
      logError("fetchEvents", err);
      toastError(getErrorMessage(err));
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchBookedEvents = async () => {
    if (!session?.user) return;

    setBookedEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          event_id,
          events (
            *
          )
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Extract events from the joined query
      const mappedEvents = (data || [])
        .map(booking => booking.events)
        .filter(event => event !== null) as unknown as Event[];

      // Ensure defaults
      const eventsWithDefaults = mappedEvents.map(event => ({
        ...event,
        visibility_type: event.visibility_type || 'public',
        event_status: event.event_status || 'upcoming',
        max_attendees: event.max_attendees || undefined,
        schedules: event.schedules || [],
        performers: event.performers || [],
        faqs: event.faqs || [],
        gallery_images: event.gallery_images || [],
        gallery_videos: event.gallery_videos || [],
        tags: event.tags || [],
      }));

      setBookedEvents(eventsWithDefaults);
    } catch (err) {
      logError("fetchBookedEvents", err);
      toastError("Failed to load booked events");
    } finally {
      setBookedEventsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      void fetchEvents();
      void fetchBookedEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const handleCreateEvent = async (data: CreateEventInput) => {
    if (!session?.user) return;

    setFormLoading(true);
    try {
      // First try with basic fields only
      const basicEventData = {
        user_id: session.user.id,
        user_email: session.user.email || '', // Add user_email to fix constraint violation
        event_name: data.event_name,
        event_description: data.event_description,
        start_date: data.start_date,
        start_time: data.start_time,
        end_date: data.end_date,
        end_time: data.end_time,
        timezone: data.timezone,
        event_banner_url: data.event_banner_url,
        event_status: 'upcoming' // Always set to 'upcoming' for new events
      };
      
      // Try to check if new columns exist
      const { data: columnTest } = await supabase
        .from("events")
        .select("visibility_type")
        .limit(1);
      
      let eventData;
      if (columnTest !== null) {
        // New columns exist, use enhanced data
        eventData = {
          ...basicEventData,
          visibility_type: data.visibility_type || 'private',
          event_status: data.event_status || 'upcoming',
          max_attendees: data.max_attendees || null,
          
          // Venue and location
          venue_name: data.venue_name,
          venue_address: data.venue_address,
          venue_city: data.venue_city,
          venue_landmark: data.venue_landmark,
          venue_type: data.venue_type,
          venue_latitude: data.venue_latitude,
          venue_longitude: data.venue_longitude,
          google_maps_url: data.google_maps_url,
          
          // Organizer info
          organizer_name: data.organizer_name,
          organizer_contact: data.organizer_contact,
          organizer_email: data.organizer_email,
          
          // JSON arrays
          schedules: data.schedules,
          performers: data.performers,
          gallery_images: data.gallery_images,
          gallery_videos: data.gallery_videos,
          faqs: data.faqs,
          tags: data.tags
        };
      } else {
        // New columns don't exist, use basic data
        eventData = basicEventData;
      }
      
      const { error } = await supabase.from("events").insert([eventData]);

      if (error) {
        // If enhanced creation failed, try with basic data
        if (eventData !== basicEventData) {
          const { error: basicError } = await supabase.from("events").insert([basicEventData]);
          if (basicError) {
            throw new Error(basicError.message || "Failed to create event");
          }
        } else {
          throw new Error(error.message || "Failed to create event");
        }
      }

      // Update local state immediately for better UX
      setShowForm(false);
      
      // Fetch fresh data from database
      await fetchEvents();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      throw err;
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleCloseForm = () => {
    setShowForm(false);
  };

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Dashboard', href: '/customer-dashboard' },
    { label: 'Profile', href: '/profile' }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <LoadingScreen message="Authenticating..." isLoading={loading || (!!session && !userProfile)} />
      
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <Squares
          direction="diagonal"
          speed={0.8}
          borderColor="rgba(34, 197, 94, 0.3)"
          squareSize={40}
          hoverFillColor="rgba(34, 197, 94, 0.1)"
        />
      </div>
      
      {session && userProfile?.role === "customer" && (
        <>
          {/* Navigation */}
          <PillNav
            items={navItems}
            activeHref="/customer-dashboard"
            userEmail={session?.user?.email}
            onSignOut={handleSignOut}
            showAuth={true}
          />

          {/* Content */}
          <div className="relative z-20 max-w-7xl mx-auto px-6 py-12 pt-24">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8 bg-zinc-950/90 backdrop-blur-sm rounded-xl p-6 border border-zinc-700">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  {activeTab === 'my-events' ? 'My Events' : activeTab === 'attending' ? 'Attending' : 'Discover Events'}
                </h1>
                <p className="text-gray-400">
                  {activeTab === 'my-events' 
                    ? 'Create and manage your events'
                    : activeTab === 'attending'
                    ? 'Events you have RSVP\'d to'
                    : 'Discover and RSVP to public events'
                  }
                </p>
              </div>
              {activeTab === 'my-events' && (
                <button
                  onClick={() => {
                    setShowForm(true);
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition flex items-center gap-2"
                >
                  <Plus size={20} />
                  Create Event
                </button>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-8 bg-zinc-800/60 backdrop-blur-md rounded-xl p-1 border border-zinc-700/50 shadow-lg">
              <button
                onClick={() => setActiveTab('my-events')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'my-events'
                    ? 'bg-zinc-900/90 text-white shadow-md backdrop-blur-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/30'
                }`}
              >
                <Calendar size={18} />
                My Events
              </button>
              <button
                onClick={() => setActiveTab('attending')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'attending'
                    ? 'bg-zinc-900/90 text-white shadow-md backdrop-blur-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/30'
                }`}
              >
                <Ticket size={18} />
                Attending
              </button>
              <button
                onClick={() => setActiveTab('discover')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'discover'
                    ? 'bg-zinc-900/90 text-white shadow-md backdrop-blur-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/30'
                }`}
              >
                <Globe size={18} />
                Discover Events
              </button>
            </div>

            {/* Tab Content */}
            <div className="mb-8 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-zinc-700 p-6">
              {activeTab === 'my-events' ? (
                <EventList
                  events={events}
                  isLoading={eventsLoading}
                />
              ) : activeTab === 'attending' ? (
                <EventList
                  events={bookedEvents}
                  isLoading={bookedEventsLoading}
                />
              ) : (
                <PublicEventList />
              )}
            </div>

            {/* Account Information Card */}
            <div className="p-6 border border-gray-200 dark:border-zinc-700 rounded-xl bg-gray-50/90 dark:bg-zinc-900/70 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Account Information
              </h2>
              <div className="space-y-3 text-gray-600 dark:text-zinc-400">
                <p>
                  <span className="text-gray-900 dark:text-white font-medium">Email:</span>{" "}
                  {session.user.email}
                </p>
                <p>
                  <span className="text-gray-900 dark:text-white font-medium">Account Type:</span>{" "}
                  <span className="text-green-700 dark:text-green-500">Customer</span>
                </p>
                <p>
                  <span className="text-gray-900 dark:text-white font-medium">Total Events:</span>{" "}
                  <span className="text-gray-900 dark:text-white">{events.length}</span>
                </p>
                <p>
                  <span className="text-gray-900 dark:text-white font-medium">User ID:</span>{" "}
                  <code className="text-xs bg-gray-200 dark:bg-black/50 px-2 py-1 rounded text-gray-900 dark:text-gray-400">
                    {session.user.id}
                  </code>
                </p>
              </div>
            </div>
          </div>

          {/* Event Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-zinc-950 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-800 shadow-2xl">
                <div className="flex-1 overflow-y-auto p-6">
                  <EnhancedEventForm
                    event={undefined}
                    onSubmit={handleCreateEvent}
                    onClose={handleCloseForm}
                    isLoading={formLoading}
                    userEmail={session.user.email || ""}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      <Toast />
    </div>
  );
}
