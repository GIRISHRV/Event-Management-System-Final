"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { LogOut, Plus, Calendar, Globe } from "lucide-react";
import { EventForm } from "@/components/EventForm";
import { EventList } from "@/components/EventList";
import { PublicEventList } from "@/components/PublicEventList";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Event, CreateEventInput } from "@/lib/supabase-types";
import { logError, showErrorAlert } from "@/lib/error-handler";
import Squares from "@/components/Squares";
import PillNav from "@/components/PillNav";

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-events' | 'discover'>('my-events');

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
      // Query with all available columns from your database schema
      const { data, error } = await supabase
        .from("events")
        .select(`
          id, user_id, user_email, event_name, event_description, 
          start_date, start_time, end_date, end_time, timezone, 
          event_banner_url, visibility_type, event_status, 
          max_attendees, rsvp_required, rsvp_deadline, age_restrictions,
          venue_name, venue_address, venue_city, venue_state, venue_country,
          venue_postal_code, venue_landmark, venue_type, google_maps_url,
          venue_latitude, venue_longitude, organizer_name, organizer_contact,
          organizer_email, parking_available, food_stalls, alcohol_available,
          wheelchair_access, kids_allowed, pets_allowed,
          schedules, performers, vendors, faqs, safety_guidelines,
          facilities, invitations, rsvps, tags,
          created_at, updated_at
        `)
        .eq("user_email", session.user.email) // Use user_email instead of user_id
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
        rsvp_required: event.rsvp_required ?? false,
        max_attendees: event.max_attendees || undefined,
        rsvp_deadline: event.rsvp_deadline || undefined,
        parking_available: event.parking_available ?? false,
        food_stalls: event.food_stalls ?? false,
        alcohol_available: event.alcohol_available ?? false,
        wheelchair_access: event.wheelchair_access ?? false,
        kids_allowed: event.kids_allowed ?? true,
        pets_allowed: event.pets_allowed ?? false,
        schedules: event.schedules || [],
        performers: event.performers || [],
        vendors: event.vendors || [],
        faqs: event.faqs || [],
        safety_guidelines: event.safety_guidelines || [],
        facilities: event.facilities || [],
        invitations: event.invitations || [],
        rsvps: event.rsvps || [],
        tags: event.tags || [],
      }));
      
      setEvents(eventsWithDefaults);
      console.log("✅ Successfully loaded events with full schema");
      
    } catch (err) {
      logError("fetchEvents", err);
      showErrorAlert(err);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      void fetchEvents();
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
          event_status: data.event_status || 'upcoming', // Use provided status or default to upcoming
          rsvp_required: data.rsvp_required ?? false,
          max_attendees: data.max_attendees || null,
          rsvp_deadline: data.rsvp_deadline || null
        };
        console.log("✅ Using enhanced event creation with all fields");
      } else {
        // New columns don't exist, use basic data
        eventData = basicEventData;
        console.log("ℹ️ Using basic event creation - run database migration for enhanced features");
      }
      
      const { error } = await supabase.from("events").insert([eventData]);

      if (error) {
        console.error("Supabase error:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        // If enhanced creation failed, try with basic data
        if (eventData !== basicEventData) {
          console.log("Retrying with basic event data...");
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
      setEditingEvent(undefined);
      
      // Fetch fresh data from database
      await fetchEvents();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error creating event:", errorMessage);
      throw err;
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateEvent = async (data: CreateEventInput) => {
    if (!editingEvent) return;

    setFormLoading(true);
    try {
      // Try basic update first
      const basicUpdateData = {
        event_name: data.event_name,
        event_description: data.event_description,
        start_date: data.start_date,
        start_time: data.start_time,
        end_date: data.end_date,
        end_time: data.end_time,
        timezone: data.timezone,
        event_banner_url: data.event_banner_url,
        event_status: data.event_status || 'upcoming' // Include event_status
      };
      
      // Check if new columns exist
      const { data: columnTest } = await supabase
        .from("events")
        .select("visibility_type")
        .limit(1);
      
      let updateData;
      if (columnTest !== null) {
        // New columns exist, use enhanced data
        updateData = {
          ...basicUpdateData,
          visibility_type: data.visibility_type || 'private',
          event_status: data.event_status || 'upcoming', // Use provided status or default
          rsvp_required: data.rsvp_required ?? false,
          max_attendees: data.max_attendees || null,
          rsvp_deadline: data.rsvp_deadline || null
        };
      } else {
        updateData = basicUpdateData;
      }
      
      const { error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", editingEvent.id);

      if (error) {
        console.error("Update error:", error);
        // If enhanced update failed, try with basic data
        if (updateData !== basicUpdateData) {
          const { error: basicError } = await supabase
            .from("events")
            .update(basicUpdateData)
            .eq("id", editingEvent.id);
          if (basicError) throw basicError;
        } else {
          throw error;
        }
      }

      setShowForm(false);
      setEditingEvent(undefined);
      await fetchEvents();
    } catch (err) {
      console.error("Error updating event:", err);
      throw err;
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    setEventsLoading(true);
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(error.message || "Failed to delete event");
      }

      await fetchEvents();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error deleting event:", errorMessage);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEvent(undefined);
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  // If session exists but profile still loading, show loading
  if (session && !userProfile) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-gray-800 dark:text-white">Loading profile...</p>
      </div>
    );
  }

  // If not authenticated or not a customer, return null (redirect happens in useEffect)
  if (!session || userProfile?.role !== "customer") {
    return null;
  }

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Dashboard', href: '/customer-dashboard' }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
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
              {activeTab === 'my-events' ? 'My Events' : 'Discover Events'}
            </h1>
            <p className="text-gray-400">
              {activeTab === 'my-events' 
                ? 'Create and manage your events'
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
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              isLoading={eventsLoading}
              currentUserId={session.user.id}
              showActions={true}
            />
          ) : (
            <PublicEventList currentUserId={session.user.id} />
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
        <EventForm
          event={editingEvent}
          onSubmit={
            editingEvent ? handleUpdateEvent : handleCreateEvent
          }
          onClose={handleCloseForm}
          isLoading={formLoading}
          userEmail={session.user.email || ""}
        />
      )}
    </div>
  );
}
