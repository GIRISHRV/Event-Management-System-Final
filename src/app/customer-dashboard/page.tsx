"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Plus } from "lucide-react";
import { EnhancedEventForm } from "@/components/event-form/EnhancedEventForm";
import { EventListWithActions } from "@/components/events/EventListWithActions";
import { PublicEventListWithFavorites } from "@/components/events/PublicEventListWithFavorites";
import { UpcomingEventBanner } from "@/components/events/UpcomingEventBanner";
import { RecentlyViewed } from "@/components/events/RecentlyViewed";
import { EventRecommendations } from "@/components/events/EventRecommendations";
import { EventCalendarView } from "@/components/events/EventCalendarView";
import { EventMapCluster } from "@/components/events/EventMapCluster";
import VendorMarketplace from "@/components/customer/VendorMarketplace";
import { DashboardHeader } from "@/components/customer/DashboardHeader";
import { DashboardToolbar } from "@/components/customer/DashboardToolbar";
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
  const [eventsLoading, setEventsLoading] = useState(true);
  const [bookedEventsLoading, setBookedEventsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'my-events' | 'attending' | 'discover' | 'find-vendors'>('my-events');
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'map'>('grid');
  const [isAIOpen, setIsAIOpen] = useState(false);

  // Fake loading delay constant
  const MIN_LOADING_TIME = 1500;

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
  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.push("/signin");
      } else if (userProfile && userProfile.role !== "customer") {
        router.push("/vendor-dashboard");
      }
    }
  }, [session, userProfile, loading, router]);

  const fetchEvents = useCallback(async () => {
    if (!session?.user) return;

    setEventsLoading(true);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from("events")
        .select(`
          id, user_id, user_email, event_name, event_description, 
          start_date, start_time, end_date, end_time, timezone, 
          event_banner_url, visibility_type, event_status, 
          max_attendees,
          venue_name, venue_address, venue_city, venue_landmark, 
          venue_type, venue_latitude, venue_longitude, google_maps_url,
          organizer_name, organizer_contact,
          organizer_email,
          schedules, performers, faqs,
          gallery_images, gallery_videos, tags,
          created_at, updated_at
        `)
        .eq("user_email", session.user.email)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
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
      // Ensure minimum loading time
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => setEventsLoading(false), remaining);
    }
  }, [session?.user, toastError]);

  const fetchBookedEvents = useCallback(async () => {
    if (!session?.user) return;

    setBookedEventsLoading(true);
    const startTime = Date.now();

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

      const mappedEvents = (data || [])
        .map(booking => booking.events)
        .filter(event => event !== null) as unknown as Event[];

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
      // Ensure minimum loading time
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => setBookedEventsLoading(false), remaining);
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
    setIsAIOpen(false);
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
    { label: 'Events', href: '/events' },
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
            <DashboardHeader 
              activeTab={activeTab} 
              onCreateEvent={() => {
                setEditingEvent(undefined);
                setShowForm(true);
              }} 
            />

            <DashboardToolbar
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as 'my-events' | 'attending' | 'discover' | 'find-vendors')}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

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
            <div className="mb-8 bg-zinc-950/90 backdrop-blur-sm rounded-xl border border-zinc-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Calendar View */}
              {viewMode === 'calendar' && (
                <EventCalendarView
                  events={activeTab === 'my-events' ? events : activeTab === 'attending' ? bookedEvents : [...events, ...bookedEvents]}
                  isLoading={activeTab === 'my-events' ? eventsLoading : activeTab === 'attending' ? bookedEventsLoading : (eventsLoading || bookedEventsLoading)}
                />
              )}

              {/* Map View */}
              {viewMode === 'map' && (
                <EventMapCluster
                  events={activeTab === 'my-events' ? events : activeTab === 'attending' ? bookedEvents : [...events, ...bookedEvents]}
                  isLoading={activeTab === 'my-events' ? eventsLoading : activeTab === 'attending' ? bookedEventsLoading : (eventsLoading || bookedEventsLoading)}
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
                  ) : activeTab === 'find-vendors' ? (
                    <VendorMarketplace />
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Event Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-200 backdrop-blur-sm overflow-x-auto">
              <div className={`flex items-stretch gap-6 transition-all duration-500 w-full max-w-[95vw] ${isAIOpen ? '' : 'justify-center'}`}>
                {/* AI Panel Slot */}
                <div 
                  id="ai-panel-slot" 
                  className={`shrink-0 transition-all duration-500 ease-in-out ${isAIOpen ? 'w-1/2 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10'}`}
                  style={{ overflow: 'hidden' }}
                />

                <div className={`bg-zinc-950 rounded-2xl max-h-[85vh] overflow-hidden flex flex-col border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 transition-all duration-500 ease-in-out ${isAIOpen ? 'w-1/2' : 'w-full max-w-5xl'}`}>
                  <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <h3 className="text-xl font-semibold text-white">
                      {editingEvent ? 'Edit Event' : 'Create New Event'}
                    </h3>
                    <button 
                      onClick={handleCloseForm}
                      className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-zinc-800 rounded-lg"
                    >
                      <Plus className="rotate-45" size={24} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <EnhancedEventForm
                      event={editingEvent}
                      onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
                      onClose={handleCloseForm}
                      isLoading={formLoading}
                      userEmail={session.user.email || ""}
                      onAIStateChange={setIsAIOpen}
                    />
                  </div>
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
