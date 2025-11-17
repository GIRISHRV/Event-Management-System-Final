"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { LogOut, Plus } from "lucide-react";
import { EventForm } from "@/components/EventForm";
import { EventList } from "@/components/EventList";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Event, CreateEventInput } from "@/lib/supabase-types";

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { session, userProfile, loading, signOut } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();
  const [formLoading, setFormLoading] = useState(false);

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
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error("Error fetching events:", err);
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
      const { error } = await supabase.from("events").insert([
        {
          ...data,
          user_id: session.user.id,
        },
      ]);

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(error.message || "Failed to create event");
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
      const { error } = await supabase
        .from("events")
        .update(data)
        .eq("id", editingEvent.id);

      if (error) throw error;

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
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-gray-800 dark:text-white">Loading...</p>
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

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-gray-200 dark:border-zinc-700">
        <button
          onClick={() => router.push("/")}
          className="text-2xl font-bold text-green-700 dark:text-green-500 hover:text-green-800 dark:hover:text-green-400 transition"
        >
          EMS (WIP) - Customer
        </button>
        <div className="flex items-center gap-4">
          <div className="text-gray-700 dark:text-gray-300 text-sm">
            Welcome, <span className="font-medium">{session.user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <LogOut size={18} />
            Sign Out
          </button>
          <ThemeToggle />
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">My Events</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and manage your events
            </p>
          </div>
          <button
            onClick={() => {
              setEditingEvent(undefined);
              setShowForm(true);
            }}
            className="px-6 py-3 bg-green-700 dark:bg-green-600 text-white rounded-lg font-medium hover:bg-green-800 dark:hover:bg-green-700 transition flex items-center gap-2"
          >
            <Plus size={20} />
            Create Event
          </button>
        </div>

        {/* Events List Section */}
        <div className="mb-8">
          <EventList
            events={events}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
            isLoading={eventsLoading}
          />
        </div>

        {/* Account Information Card */}
        <div className="p-6 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
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
