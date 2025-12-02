"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Plus, Calendar, Globe, Ticket, LayoutGrid, CalendarDays, Map } from "lucide-react";
import { EnhancedEventForm } from "@/components/event-form/EnhancedEventForm";
import { EventListWithActions } from "@/components/events/EventListWithActions";
import { PublicEventListWithFavorites } from "@/components/events/PublicEventListWithFavorites";
import { UpcomingEventBanner } from "@/components/events/UpcomingEventBanner";
import { RecentlyViewed } from "@/components/events/RecentlyViewed";
import { EventRecommendations } from "@/components/events/EventRecommendations";
import { EventCalendarView } from "@/components/events/EventCalendarView";
import { EventMapCluster } from "@/components/events/EventMapCluster";
import type { Event, CreateEventInput } from "@/lib/supabase-types";
import { logError, getErrorMessage } from "@/lib/error-handler";
import Squares from "@/components/ui/Squares";
import PillNav from "@/components/layout/PillNav";
import { useToast } from "@/components/ui/Toast";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { InlineErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();
  const { error: toastError, success: toastSuccess, Toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [bookedEvents, setBookedEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true); // Start true to show skeleton until data loads
  const [bookedEventsLoading, setBookedEventsLoading] = useState(true); // Start true
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'my-events' | 'attending' | 'discover'>('my-events');
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'map'>('grid');

  // Get the next upcoming event
  const nextUpcomingEvent = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Combine created and booked events, sort by date
    const allEvents = [...events, ...bookedEvents]
      .filter(e => new Date(e.start_date) >= today)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    
    return allEvents[0] || null;
  }, [events, bookedEvents]);

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

  const fetchEvents = useCallback(async () => {
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
  }, [session?.user, toastError]);

  const fetchBookedEvents = useCallback(async () => {
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
  }, [session?.user, toastError]);

  useEffect(() => {
    if (session?.user) {
      void fetchEvents();
      void fetchBookedEvents();
    } else if (!loading) {
      // No session and auth loading is done - stop showing skeletons
      setEventsLoading(false);
      setBookedEventsLoading(false);
    }
  }, [session?.user, loading, fetchEvents, fetchBookedEvents]);

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
    setEditingEvent(undefined);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("user_email", session?.user?.email);

      if (error) throw error;

      toastSuccess("Event deleted successfully");
      await fetchEvents();
    } catch (err) {
      logError("deleteEvent", err);
      toastError(getErrorMessage(err));
    }
  };

  const handleUpdateEvent = async (data: CreateEventInput) => {
    if (!session?.user || !editingEvent) return;

    setFormLoading(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingEvent.id)
        .eq("user_email", session.user.email);

      if (error) throw error;

      toastSuccess("Event updated successfully");
      setShowForm(false);
      setEditingEvent(undefined);
      await fetchEvents();
    } catch (err) {
      throw err;
    } finally {
      setFormLoading(false);
    }
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
                    setEditingEvent(undefined);
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
            <div className="flex space-x-1 mb-4 bg-zinc-800/60 backdrop-blur-md rounded-xl p-1 border border-zinc-700/50 shadow-lg">
              <button
                onClick={() => setActiveTab('my-events')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset ${
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
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset ${
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
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset ${
                  activeTab === 'discover'
                    ? 'bg-zinc-900/90 text-white shadow-md backdrop-blur-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/30'
                }`}
              >
                <Globe size={18} />
                Discover Events
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex justify-end mb-4">
              <div className="flex bg-zinc-800/60 backdrop-blur-md rounded-lg p-1 border border-zinc-700/50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition ${
                    viewMode === 'grid'
                      ? 'bg-green-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`p-2 rounded-md transition ${
                    viewMode === 'calendar'
                      ? 'bg-green-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                  title="Calendar View"
                >
                  <CalendarDays size={18} />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`p-2 rounded-md transition ${
                    viewMode === 'map'
                      ? 'bg-green-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                  title="Map View"
                >
                  <Map size={18} />
                </button>
              </div>
            </div>

            {/* Upcoming Event Banner - Show on My Events and Attending tabs */}
            {(activeTab === 'my-events' || activeTab === 'attending') && nextUpcomingEvent && (
              <InlineErrorBoundary name="Upcoming Event">
                <UpcomingEventBanner event={nextUpcomingEvent} />
              </InlineErrorBoundary>
            )}

            {/* Recently Viewed - Show on Discover tab */}
            {activeTab === 'discover' && session?.user?.id && (
              <InlineErrorBoundary name="Recently Viewed">
                <RecentlyViewed userId={session.user.id} />
              </InlineErrorBoundary>
            )}

            {/* Event Recommendations - Show on Discover tab */}
            {activeTab === 'discover' && session?.user?.id && (
              <InlineErrorBoundary name="Recommendations">
                <EventRecommendations
                  bookedEvents={bookedEvents}
                  userId={session.user.id}
                />
              </InlineErrorBoundary>
            )}

            {/* Tab Content */}
            <div className="mb-8 bg-zinc-950/90 backdrop-blur-sm rounded-xl border border-zinc-700 p-6">
              {/* Calendar View */}
              {viewMode === 'calendar' && (
                <EventCalendarView
                  events={activeTab === 'my-events' ? events : activeTab === 'attending' ? bookedEvents : [...events, ...bookedEvents]}
                />
              )}

              {/* Map View */}
              {viewMode === 'map' && (
                <EventMapCluster
                  events={activeTab === 'my-events' ? events : activeTab === 'attending' ? bookedEvents : [...events, ...bookedEvents]}
                />
              )}

              {/* Grid View - Default */}
              {viewMode === 'grid' && (
                <>
                  {activeTab === 'my-events' ? (
                    <EventListWithActions
                      events={events}
                      isLoading={eventsLoading}
                      showSearch={true}
                      showQuickActions={true}
                      type="my-events"
                      onEdit={handleEditEvent}
                      onDelete={handleDeleteEvent}
                      onCreateNew={() => setShowForm(true)}
                    />
                  ) : activeTab === 'attending' ? (
                    <EventListWithActions
                      events={bookedEvents}
                      isLoading={bookedEventsLoading}
                      showSearch={true}
                      showQuickActions={true}
                      type="attending"
                      onDiscoverEvents={() => setActiveTab('discover')}
                    />
                  ) : activeTab === 'discover' ? (
                    <PublicEventListWithFavorites userId={session.user.id} />
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Event Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-zinc-950 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-800 shadow-2xl">
                <div className="flex-1 overflow-y-auto p-6">
                  <EnhancedEventForm
                    event={editingEvent}
                    onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
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
