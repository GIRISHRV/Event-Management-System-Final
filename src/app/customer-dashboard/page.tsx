"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useMyEvents, usePublicEvents } from "@/hooks/useEvents";
import { eventsService } from "@/services/events.service";
import type { EventRow, EventFormData } from "@/schemas/event.schema";
import type { Event } from "@/lib/supabase-types";
import { Calendar, Store, Ticket, ExternalLink, Clock, MapPin } from "lucide-react";
import { supabase } from "@/services/supabase/client";
import useSWR from "swr";
import Link from "next/link";

import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardToolbar, CUSTOMER_TABS } from "@/components/dashboard/DashboardToolbar";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { DashboardRequestsList } from "@/components/dashboard/DashboardRequestsList";
import { BudgetTracker } from "@/components/dashboard/BudgetTracker";
import { EventList } from "@/components/events/EventList";
import { UpcomingEventBanner } from "@/components/events/UpcomingEventBanner";
import { EventRecommendations } from "@/components/events/EventRecommendations";
import { EventFormDrawer } from "@/components/event-form/EventFormDrawer";
import { VendorMarketplace } from "@/components/customer/VendorMarketplace";
import { useToast } from "@/hooks/useToast";
import { InlineErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EventVendorsList } from "@/components/events/EventVendorsList";
import { EventMap } from "@/components/events/EventMap";
import { CommunityFilter } from "@/components/events/CommunityFilter";
import { BookingStatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";

// ─── My Bookings Panel ────────────────────────────────────────────────────────
// Shows events the current user has RSVP'd to (not attendees of their events)

interface MyBookingRow {
  id: string;
  status: string;
  created_at: string;
  event_id: string;
  events: {
    id: string;
    event_name: string;
    start_date: string;
    start_time: string;
    venue_city: string | null;
    venue_name: string | null;
    event_banner_url: string | null;
    event_status: string;
  } | null;
}

function MyBookingsPanel({ userId }: { userId: string }) {
  const { data: bookings, isLoading } = useSWR(
    userId ? ["my-bookings", userId] : null,
    async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, status, created_at, event_id,
          events (
            id, event_name, start_date, start_time,
            venue_city, venue_name, event_banner_url, event_status
          )
        `)
        .eq("user_id", userId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Supabase returns the joined relation as an array; we normalise to single object
      return (data ?? []).map((row) => ({
        ...row,
        events: Array.isArray(row.events) ? row.events[0] ?? null : row.events,
      })) as MyBookingRow[];
    }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-background)]/50">
        <Ticket className="mx-auto mb-3 opacity-20 text-[var(--color-brand)]" size={40} />
        <p className="font-semibold text-[var(--color-text-primary)]">No bookings yet</p>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          RSVP to events on the Discover tab to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Ticket size={16} className="text-[var(--color-brand)]" />
        <h3 className="font-bold text-[var(--color-text-primary)]">
          My RSVPs ({bookings.length})
        </h3>
      </div>
      {bookings.map((booking) => {
        const event = booking.events;
        if (!event) return null;
        return (
          <Link
            key={booking.id}
            href={`/event/${event.id}`}
            className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-hover)] transition-all group"
          >
            {/* Colour strip */}
            <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-gradient-to-br from-[var(--color-brand)]/20 to-purple-500/20 border border-[var(--color-border)] flex items-center justify-center text-[11px] font-black text-[var(--color-brand)] uppercase">
              {event.event_name.slice(0, 2)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-brand)] transition-colors">
                {event.event_name}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-tertiary)]">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(event.start_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {event.venue_city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {event.venue_city}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <BookingStatusBadge status={booking.status as "confirmed" | "waitlist" | "cancelled"} />
              <ExternalLink size={14} className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomerDashboardPage() {
  const { session, userProfile, loading } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("my-events");
  const [viewMode, setViewMode] = useState<"grid" | "calendar" | "map">("grid");
  const [communityFilterIds, setCommunityFilterIds] = useState<string[] | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [eventTrends, setEventTrends] = useState<Record<string, "increasing" | "decreasing" | "stable">>({});

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    async function fetchFavorites() {
      const { data } = await supabase
        .from("favorites")
        .select("event_id")
        .eq("user_id", userId);
      if (data) {
        setFavorites(new Set(data.map(f => f.event_id)));
      }
    }
    fetchFavorites();
  }, [userId]);

  const { events: myEvents, isLoading: myEventsLoading, mutate: mutateMyEvents } = useMyEvents(userId, { page: 1, limit: 50 });
  const { events: publicEvents, isLoading: publicEventsLoading } = usePublicEvents({ page: 1, limit: 50 });

  const nextUpcomingEvent = useMemo(() => {
    if (!myEvents) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return myEvents
      .filter(e => new Date(e.start_date) >= today)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0] || null;
  }, [myEvents]);

  const bookedEventsForRecommender = useMemo(
    () => (myEvents ?? []) as unknown as Event[],
    [myEvents]
  );

  useEffect(() => {
    if (!myEvents || myEvents.length === 0) return;
    async function fetchTrends() {
      const { data } = await supabase
        .from("attendance_forecasts")
        .select("event_id, trend")
        .in("event_id", myEvents.map(e => e.id));
      if (data) {
        const trendMap: Record<string, "increasing" | "decreasing" | "stable"> = {};
        data.forEach(row => {
          trendMap[row.event_id] = row.trend;
        });
        setEventTrends(trendMap);
      }
    }
    fetchTrends();
  }, [myEvents]);

  const filteredPublicEvents = useMemo(() => {
    if (!communityFilterIds) return publicEvents;
    return (publicEvents ?? []).filter(e => communityFilterIds.includes(e.id));
  }, [publicEvents, communityFilterIds]);

  const handleCreateEvent = useCallback(async (data: EventFormData) => {
    if (!userId || !session?.user?.email) return;
    setFormLoading(true);
    try {
      const result = await eventsService.createEvent(data, userId, session.user.email);
      if (!result.success) throw new Error(result.error?.message);
      toastSuccess("Event created successfully!");
      mutateMyEvents();
      setIsFormOpen(false);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setFormLoading(false);
    }
  }, [userId, session, mutateMyEvents, toastSuccess, toastError]);

  const handleUpdateEvent = useCallback(async (data: EventFormData) => {
    if (!userId || !editingEvent?.id || !session?.user?.email) return;
    setFormLoading(true);
    try {
      const result = await eventsService.updateEvent(editingEvent.id, data, userId, session.user.email);
      if (!result.success) throw new Error(result.error?.message);
      toastSuccess("Event updated successfully!");
      mutateMyEvents();
      setIsFormOpen(false);
      setEditingEvent(undefined);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setFormLoading(false);
    }
  }, [userId, session, editingEvent, mutateMyEvents, toastSuccess, toastError]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!userId) return;
    try {
      const result = await eventsService.deleteEvent(eventId, userId);
      if (!result.success) throw new Error(result.error?.message);
      toastSuccess("Event deleted successfully!");
      mutateMyEvents();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Failed to delete event");
    }
  }, [userId, mutateMyEvents, toastSuccess, toastError]);

  const handleToggleFavorite = useCallback(async (event: EventRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!userId || !event.id) return;
    const eventId = event.id;

    const isAdding = !favorites.has(eventId);

    setFavorites(prev => {
      const next = new Set(prev);
      if (isAdding) next.add(eventId);
      else next.delete(eventId);
      return next;
    });

    try {
      if (isAdding) {
        await supabase.from("user_interactions").upsert({
          user_id: userId,
          event_id: eventId,
          interaction_type: "favorite",
          implicit_score: 0.7
        }, { onConflict: 'user_id,event_id,interaction_type' });

        await supabase.from("favorites").upsert({
          user_id: userId,
          event_id: eventId
        }, { onConflict: 'user_id,event_id' });
      } else {
        await supabase.from("user_interactions")
          .delete()
          .eq("user_id", userId)
          .eq("event_id", eventId)
          .eq("interaction_type", "favorite");

        await supabase.from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("event_id", eventId);
      }

      // Cache invalidation: let the 30-min TTL in recommendations route
      // handle natural expiry. No need to delete on every toggle (#13).
    } catch (err: unknown) {
      console.error("Failed to toggle favorite:", err);
      setFavorites(prev => {
        const next = new Set(prev);
        if (isAdding) next.delete(eventId);
        else next.add(eventId);
        return next;
      });
      toastError(err instanceof Error ? err.message : "Failed to update favorite");
    }
  }, [userId, favorites, toastError]);

  const openEditForm = useCallback((event: EventRow) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  }, []);

  const handleCommunityFilter = useCallback((ids: string[] | null) => {
    setCommunityFilterIds(ids);
  }, []);

  const router = useRouter();

  useEffect(() => {
    if (!loading && (!session || userProfile?.role !== "customer")) {
      router.push("/signin");
    }
  }, [loading, session, userProfile, router]);

  if (loading || (session && !userProfile)) return <LoadingScreen />;
  if (!session || userProfile?.role !== "customer") return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardHeader
        title={`Welcome back, ${userProfile?.full_name || 'User'}`}
        subtitle="Manage your events and discover new vendors for your next big occasion."
        onPrimaryAction={() => setIsFormOpen(true)}
        primaryActionLabel="Create Event"
        stats={[
          {
            label: "My Events",
            value: myEvents?.length || 0,
            icon: Calendar,
          }
        ]}
      />

      <DashboardToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={CUSTOMER_TABS}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        hideViewFor={["vendors", "inquiries", "pro-team"]}
      />

      {activeTab === "my-events" && nextUpcomingEvent && (
        <InlineErrorBoundary name="Upcoming Event">
          <UpcomingEventBanner event={nextUpcomingEvent} />
        </InlineErrorBoundary>
      )}

      {activeTab === "discover" && userId && (
        <InlineErrorBoundary name="Recommendations">
          <EventRecommendations
            userId={userId}
            bookedEvents={bookedEventsForRecommender}
          />
        </InlineErrorBoundary>
      )}

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6">
        {(activeTab === "my-events" || activeTab === "discover") && (
          <div className="space-y-6">
            {activeTab === "discover" && viewMode === "grid" && (
              <CommunityFilter onFilter={handleCommunityFilter} />
            )}

            {viewMode === "grid" && (
              <EventList
                events={activeTab === "my-events" ? myEvents : filteredPublicEvents}
                isLoading={activeTab === "my-events" ? myEventsLoading : publicEventsLoading}
                emptyTitle={activeTab === "discover" ? "No Public Events" : "No Events Yet"}
                emptyDescription={activeTab === "discover" ? "Check back soon for new events." : "Click 'Create Event' to get started."}
                showFavorite={activeTab === "discover"}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onEdit={activeTab === "my-events" ? openEditForm : undefined}
                onDelete={activeTab === "my-events" ? handleDeleteEvent : undefined}
                eventTrends={activeTab === "my-events" ? eventTrends : undefined}
              />
            )}

            {viewMode === "calendar" && (
              <CalendarView events={activeTab === "my-events" ? myEvents : filteredPublicEvents} />
            )}

            {viewMode === "map" && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)]">Map Explorer</h3>
                    <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-semibold">
                      {activeTab === "my-events" ? "Your Event Locations" : "Public Events Nearby"}
                    </p>
                  </div>
                </div>
                <div className="h-[500px] rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)] shadow-inner">
                  <EventMap
                    event={activeTab === "my-events" ? myEvents?.[0] : publicEvents?.[0]}
                    nearbyEvents={activeTab === "my-events" ? myEvents : publicEvents}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── My Bookings ── shows events the user has RSVP'd to */}
        {activeTab === "bookings" && userId && (
          <InlineErrorBoundary name="My Bookings">
            <MyBookingsPanel userId={userId} />
          </InlineErrorBoundary>
        )}

        {activeTab === "vendors" && <VendorMarketplace />}

        {activeTab === "pro-team" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--color-border)] pb-6">
              <div>
                <h3 className="text-xl font-bold">Your Hired Pro Team</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">Manage the vendors currently contracted for your events.</p>
              </div>
              <div className="w-full md:w-64">
                <select
                  className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
                  value={selectedEventId || ""}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                >
                  <option value="" disabled>Select an Event</option>
                  {myEvents?.map(e => <option key={e.id} value={e.id}>{e.event_name}</option>)}
                </select>
              </div>
            </div>

            {selectedEventId ? (
              <EventVendorsList eventId={selectedEventId} />
            ) : (
              <div className="py-12 text-center text-[var(--color-text-tertiary)] border border-dashed border-[var(--color-border)] rounded-lg">
                <Store className="mx-auto mb-3 opacity-20" size={48} />
                <p>Select an event to view your team.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "inquiries" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <DashboardRequestsList role="customer" />
            </div>
            <div>
              <BudgetTracker userId={userId || ""} />
            </div>
          </div>
        )}
      </div>

      <EventFormDrawer
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingEvent(undefined);
        }}
        event={editingEvent}
        onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
        isLoading={formLoading}
      />
    </div>
  );
}