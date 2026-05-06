"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar, MapPin, Share2,
  ChevronLeft, AlertCircle,
  Camera, Settings
} from "lucide-react";
import { useTrackView } from "@/hooks/useTrackView";
import { useEvent } from "@/hooks/useEvents";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RSVPButton } from "@/components/bookings/RSVPButton";
import { EventStatusBadge } from "@/components/ui/StatusBadge";
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EventChatbot } from "@/components/chat/EventChatbot";
import { AttendeeAvatars } from "@/components/events/AttendeeAvatars";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/context/AuthContext";
import { EventVendorsList } from "@/components/events/EventVendorsList";
import { AttendeeManagement } from "@/components/events/AttendeeManagement";
import { useEventBookings } from "@/hooks/useEventBookings";
import { EventFormDrawer } from "@/components/event-form/EventFormDrawer";
import { eventsService } from "@/services/events.service";
import { type EventFormData } from "@/schemas/event.schema";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import { SimilarEvents } from "@/components/events/SimilarEvents";
import { ForecastPanel } from "@/components/events/ForecastPanel";
import { EventMap } from "@/components/events/EventMap";

export default function EventDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = use(params);
  const { session } = useAuth();

  const { event, isLoading, error, mutate } = useEvent(eventId);
  const { success: toastSuccess, error: toastError } = useToast();

  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState("attendees");

  const isOwner = session?.user?.id === event?.user_id;
  const { bookings, updateBookingStatus } = useEventBookings(isOwner ? eventId : "");
  useTrackView(eventId, session?.user?.id);

  const handleUpdateEvent = async (data: EventFormData) => {
    if (!session?.user?.id || !event?.id) return;
    setIsUpdating(true);
    try {
      const result = await eventsService.updateEvent(event.id, data, session.user.id, session.user.email || "");
      if (!result.success) throw new Error(result.error?.message);
      toastSuccess("Event updated successfully!");
      mutate();
      setIsEditDrawerOpen(false);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: event?.event_name, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toastSuccess("Link copied to clipboard!");
      }
    } catch {
      toastSuccess("Link copied to clipboard!");
    }
  };

  if (isLoading) return <LoadingScreen message="Unlocking event..." isLoading={true} />;

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col pt-16">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="space-y-4">
            <AlertCircle size={48} className="mx-auto text-red-500 opacity-50" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Event not found</h1>
            <Button asChild variant="outline">
              <Link href="/events">Return to Browse</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col font-sans">
      <BackgroundEffects variant="gradient" className="opacity-40" />
      <Navbar />

      <main className="flex-1 relative z-10 pt-24 pb-20 px-4 md:px-8 max-w-7xl mx-auto w-full">
        {/* Navigation & Actions Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)] transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to All Events
          </Link>

          <div className="flex items-center gap-2">
            <Button onClick={handleShare} variant="secondary" size="sm" className="rounded-full bg-[var(--color-surface)]">
              <Share2 size={16} className="mr-2" /> Share
            </Button>
            {isOwner && (
              <Button onClick={() => setIsEditDrawerOpen(true)} variant="secondary" size="sm" className="rounded-full bg-[var(--color-surface)] border-[var(--color-brand)]/20">
                <Settings size={16} className="mr-2 text-[var(--color-brand)]" /> Manage
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* LEFT: CONTENT */}
          <div className="lg:col-span-8 space-y-12">

            {/* HERO */}
            <section className="relative aspect-video rounded-3xl overflow-hidden border border-[var(--color-border)] shadow-2xl bg-[var(--color-surface-hover)]">
              {event.event_banner_url ? (
                <Image src={event.event_banner_url} alt={event.event_name} fill className="object-cover" priority loading="eager" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/10 to-indigo-600/10">
                  <Camera size={48} className="text-[var(--color-brand)] opacity-20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <EventStatusBadge status={event.event_status} className="mb-4" />
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1]">
                  {event.event_name}
                </h1>
              </div>
            </section>

            {/* DESCRIPTION */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-6 w-1 bg-[var(--color-brand)] rounded-full" />
                <h2 className="text-xl font-bold uppercase tracking-widest">Overview</h2>
              </div>
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                {event.event_description || "No detailed description provided."}
              </p>
            </section>

            {/* GALLERY */}
            {((event.gallery_images?.length ?? 0) > 0) && (
              <section className="space-y-6">
                <h3 className="text-lg font-bold">Event Media</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
                  {event.gallery_images?.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
                      <Image src={url} alt="Gallery" fill className="object-cover hover:scale-110 transition-transform duration-500" unoptimized />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SCHEDULE LIST */}
            {event.schedules && event.schedules.length > 0 && (
              <section className="space-y-6">
                <h3 className="text-lg font-bold">The Schedule</h3>
                <div className="space-y-4 border-l-2 border-[var(--color-border)] ml-4 pl-8">
                  {event.schedules.map((item, i) => (
                    <div key={i} className="relative py-2">
                      <div className="absolute -left-[41px] top-4 w-4 h-4 rounded-full bg-[var(--color-brand)] border-4 border-[var(--color-background)] shadow-sm" />
                      <div className="flex items-center gap-3 text-xs font-bold text-[var(--color-brand)] uppercase tracking-tighter mb-1 font-sans">
                        <span>{item.start_time} - {item.end_time}</span>
                        <span>•</span>
                        <span className="text-[var(--color-text-tertiary)]">{item.location}</span>
                      </div>
                      <h4 className="font-bold text-[var(--color-text-primary)]">{item.title}</h4>
                      <p className="text-sm text-[var(--color-text-tertiary)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* VENUE MAP */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1 bg-[var(--color-brand)] rounded-full" />
                <h2 className="text-xl font-bold uppercase tracking-widest">Venue</h2>
              </div>
              <EventMap event={event} />
            </section>
          </div>

          {/* RIGHT: SIDEBAR */}
          <aside className="lg:col-span-4 space-y-6">
            <Card className="p-8 space-y-8 bg-[var(--color-surface)] border-[var(--color-border)] shadow-xl relative z-10">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--color-brand)] to-purple-500" />

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">Date</p>
                    <p className="font-bold text-[var(--color-text-primary)]">{format(new Date(event.start_date), "MMM do, yyyy")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">Location</p>
                    <p className="font-bold text-[var(--color-text-primary)]">{event.venue_name || "TBA"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-[var(--color-border)]">
                {isOwner ? (
                  <Button onClick={() => setIsEditDrawerOpen(true)} className="w-full h-14 text-lg font-bold bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] shadow-xl shadow-blue-500/10">
                    Manage Event
                  </Button>
                ) : (
                  <RSVPButton eventId={event.id} className="w-full h-14 text-lg" />
                )}
                <p className="text-center text-xs text-[var(--color-text-tertiary)] font-medium italic">
                  {event.max_attendees ? `${event.max_attendees - (event.attendee_count || 0)} spots available` : "Unlimited capacity"}
                </p>
              </div>

              <div className="pt-6 border-t border-[var(--color-border)]">
                <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest mb-4">Attendee Spotlight</p>
                <AttendeeAvatars eventId={event.id} maxDisplay={5} />
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3 bg-[var(--color-surface)]/50 border-[var(--color-border)] relative z-0">
              <div className="w-10 h-10 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center text-[var(--color-brand)] font-bold uppercase">
                {event.organizer_name?.[0] || 'O'}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold uppercase tracking-wider">Organized by</p>
                <p className="font-bold text-[var(--color-text-primary)] truncate">{event.organizer_name}</p>
              </div>
            </Card>

            {/* Similar Events — GAT+K-Means community output */}
            <SimilarEvents eventId={eventId} />
          </aside>
        </div>

        {isOwner && (
          <section className="mt-20 pt-16 border-t border-[var(--color-border)]">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)]">Event Control</h2>
                <div className="flex bg-[var(--color-surface)] p-1 rounded-full border border-[var(--color-border)]">
                  <button
                    onClick={() => setActiveAdminTab('attendees')}
                    className={cn("px-6 py-2 rounded-full text-xs font-bold transition-all", activeAdminTab === 'attendees' ? "bg-[var(--color-brand)] text-white shadow-md" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]")}
                  >Guests</button>
                  <button
                    onClick={() => setActiveAdminTab('vendors')}
                    className={cn("px-6 py-2 rounded-full text-xs font-bold transition-all", activeAdminTab === 'vendors' ? "bg-[var(--color-brand)] text-white shadow-md" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]")}
                  >Vendors</button>
                  <button
                    onClick={() => setActiveAdminTab('forecast')}
                    className={cn("px-6 py-2 rounded-full text-xs font-bold transition-all", activeAdminTab === 'forecast' ? "bg-[var(--color-brand)] text-white shadow-md" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]")}
                  >Forecast</button>
                </div>
              </div>

              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[2.5rem] p-8 shadow-sm">
                {activeAdminTab === 'attendees' ? (
                  <AttendeeManagement
                    attendees={bookings.map(b => ({
                      id: b.id,
                      full_name: b.profiles?.full_name || b.profiles?.email || "Guest",
                      email: b.profiles?.email || "",
                      status: b.status === "confirmed" ? "confirmed" : b.status === "cancelled" ? "cancelled" : "pending",
                      created_at: b.created_at,
                    }))}
                    onUpdateStatus={async (id, status) => { await updateBookingStatus(id, status as "confirmed" | "cancelled" | "waitlist"); mutate(); }}
                    onDelete={() => mutate()}
                  />
                ) : activeAdminTab === 'forecast' ? (
                  <ForecastPanel eventId={event.id} />
                ) : activeAdminTab === 'vendors' ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[var(--color-text-tertiary)]">Service providers contracted for this event.</p>
                      <Link href="/customer-dashboard">
                        <Button variant="outline" size="sm" className="rounded-full">Browse Marketplace</Button>
                      </Link>
                    </div>
                    <EventVendorsList eventId={event.id} />
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        )}
      </main>

      <EventFormDrawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        event={event}
        onSubmit={handleUpdateEvent}
        isLoading={isUpdating}
      />

      <Footer />
      <EventChatbot eventId={event.id} eventName={event.event_name} />
    </div>
  );
}