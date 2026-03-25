"use client";

import React, { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventFormBaseSchema, type EventFormData, type EventRow } from "@/schemas/event.schema";
import { EVENT_STATUS, VISIBILITY_TYPES, VENUE_TYPES } from "@/lib/constants";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Tab Subcomponents
import { BasicInfoTab } from "./BasicInfoTab";
import { VenueTab } from "./VenueTab";
import { ScheduleTab } from "./ScheduleTab";
import { GalleryTab } from "./GalleryTab";
import { FaqsTab } from "./FaqsTab";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(
  () => import("./LocationPicker").then((mod) => mod.LocationPicker),
  { ssr: false }
);

interface EventFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event?: EventRow;
  onSubmit: (data: EventFormData) => Promise<void>;
  isLoading?: boolean;
}

const mapEventToForm = (event?: EventRow): EventFormData => ({
  eventName: event?.event_name || "",
  eventDescription: event?.event_description || "",
  startDate: event?.start_date ? event.start_date.split('T')[0] : "",
  startTime: event?.start_time || "",
  endDate: event?.end_date ? event.end_date.split('T')[0] : "",
  endTime: event?.end_time || "",
  timezone: event?.timezone || "UTC",
  eventBannerUrl: event?.event_banner_url || "",
  visibilityType: event?.visibility_type || VISIBILITY_TYPES.PUBLIC,
  maxAttendees: event?.max_attendees ?? undefined,
  budget: event?.budget ?? undefined,
  organizerName: event?.organizer_name || "",
  organizerContact: event?.organizer_contact || "",
  organizerEmail: event?.organizer_email || "",
  eventStatus: event?.event_status || EVENT_STATUS.UPCOMING,
  venueName: event?.venue_name || "",
  venueAddress: event?.venue_address || "",
  venueCity: event?.venue_city || "",
  venueLandmark: event?.venue_landmark || "",
  venueType: event?.venue_type || VENUE_TYPES.INDOOR,
  venueLatitude: event?.venue_latitude || null,
  venueLongitude: event?.venue_longitude || null,
  googleMapsUrl: event?.google_maps_url || "",
  galleryImages: event?.gallery_images || [],
  galleryVideos: event?.gallery_videos || [],
  schedules: event?.schedules || [],
  performers: event?.performers || [],
  faqs: event?.faqs || [],
  tags: event?.tags || [],
});

export function EventFormDrawer({
  isOpen,
  onClose,
  event,
  onSubmit,
  isLoading = false,
}: EventFormDrawerProps) {
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormBaseSchema) as Resolver<EventFormData>,
    values: mapEventToForm(event),
  });

  const { handleSubmit, setValue, watch } = form;

  const handleFormSubmit: SubmitHandler<EventFormData> = async (data) => {
    if (data.venueLatitude === null) {
      toastError("Please select a location on the map");
      return;
    }

    if (data.startDate && data.startTime && data.endDate && data.endTime) {
      const start = new Date(`${data.startDate}T${data.startTime}`);
      const end = new Date(`${data.endDate}T${data.endTime}`);
      if (end <= start) {
        toastError("End time must be after start time");
        return;
      }
    }

    try {
      await onSubmit(data);
      toastSuccess(event ? "Event updated successfully" : "Event created successfully");
      onClose();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, "Failed to save event"));
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      setIsDeleting(true);
      const { eventsService } = await import("@/services/events.service");
      const { supabase } = await import("@/services/supabase/client");
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession?.user.id) throw new Error("No session");

      const response = await eventsService.deleteEvent(event.id, currentSession.user.id);
      if (!response.success) throw new Error(response.error?.message);

      toastSuccess("Event deleted successfully");
      onClose();
      router.push('/vendor-dashboard');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, "Failed to delete event"));
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      if ((e.target as HTMLElement).getAttribute('type') !== 'submit') {
        e.preventDefault();
      }
    }
  };

  const hasErrors = Object.keys(form.formState.errors).length > 0;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={event ? "Edit Event" : "Create Event"}
        description={event ? "Update your event details and settings." : "Create a new event and start planning your perfect gathering."}
        size="xl"
      >
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          onKeyDown={handleKeyDown}
          className="flex flex-col h-full min-h-0"
        >
          <Tabs defaultValue="basic" className="flex flex-col flex-1 min-h-0">

            {/* 1. FIXED HEADER (shrink-0 prevents it from squishing) */}
            <div className="shrink-0 pt-4 bg-[var(--color-background)] border-b border-[var(--color-border)] z-10">
              {/* Added horizontal scroll wrapper */}
              <div className="overflow-x-auto px-6 pb-2 custom-scrollbar">
                {/* Added flex-nowrap and w-max to prevent squishing */}
                <TabsList className="border-none gap-2 flex-nowrap w-max min-w-full">
                  <TabsTrigger value="basic" className="relative whitespace-nowrap">
                    Basic Info
                    {Object.keys(form.formState.errors).some(k => ['eventName', 'eventDescription', 'startDate', 'startTime', 'endDate', 'endTime', 'organizerName', 'organizerContact'].includes(k)) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--color-surface)]" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="venue" className="relative whitespace-nowrap">
                    Venue & Location
                    {Object.keys(form.formState.errors).some(k => k.startsWith('venue') || k === 'googleMapsUrl') && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--color-surface)]" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="relative whitespace-nowrap">
                    Schedule & Performers
                    {Object.keys(form.formState.errors).some(k => ['schedules', 'performers'].includes(k)) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--color-surface)]" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="gallery" className="relative whitespace-nowrap">
                    Media Gallery
                    {Object.keys(form.formState.errors).some(k => ['galleryImages', 'galleryVideos'].includes(k)) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--color-surface)]" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="faqs" className="relative whitespace-nowrap">
                    FAQs
                    {Object.keys(form.formState.errors).some(k => k === 'faqs') && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[var(--color-surface)]" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* 2. SCROLLABLE MIDDLE SECTION (flex-1 expands, overflow-y-auto enables internal scroll) */}
            <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
              <TabsContent value="basic" className="mt-0">
                <BasicInfoTab form={form} eventId={event?.id} />
              </TabsContent>

              <TabsContent value="venue" className="mt-0">
                <VenueTab form={form} onOpenMap={() => setIsMapOpen(true)} />
              </TabsContent>

              <TabsContent value="schedule" className="mt-0">
                <ScheduleTab form={form} eventId={event?.id} />
              </TabsContent>

              <TabsContent value="gallery" className="mt-0">
                <GalleryTab form={form} eventId={event?.id} />
              </TabsContent>

              <TabsContent value="faqs" className="mt-0">
                <FaqsTab form={form} />
              </TabsContent>
            </div>

            {/* 3. FIXED FOOTER (shrink-0) */}
            <div className="shrink-0 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex gap-3 justify-between z-10">
              <div className="flex gap-2">
                {event && !showConfirmDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowConfirmDelete(true)}
                    className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                  >
                    Delete Event
                  </Button>
                )}
                {showConfirmDelete && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                    <span className="text-sm text-red-400 font-medium mr-2">Confirm Delete?</span>
                    <Button type="button" variant="primary" size="sm" onClick={handleDelete} disabled={isDeleting} className="bg-red-500 hover:bg-red-600 border-none h-8 px-3">
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Delete"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowConfirmDelete(false)} className="h-8 px-3">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose} className="w-32">
                  Cancel
                </Button>
                <div className="relative">
                  <Button type="submit" variant="primary" disabled={isLoading || isDeleting} className="w-40">
                    {(isLoading || isDeleting) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {event ? "Update Event" : "Save Event"}
                  </Button>
                  {hasErrors && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[var(--color-surface)] shadow-lg animate-in zoom-in">
                      {Object.keys(form.formState.errors).length}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </Tabs>
        </form>
      </Drawer>

      {isMapOpen && (
        <LocationPicker
          isOpen={isMapOpen}
          initialLocation={
            watch("venueLatitude") && watch("venueLongitude")
              ? { lat: watch("venueLatitude") as number, lng: watch("venueLongitude") as number }
              : null
          }
          onClose={() => setIsMapOpen(false)}
          onConfirm={(location) => {
            setValue("venueLatitude", location.lat, { shouldValidate: true, shouldDirty: true });
            setValue("venueLongitude", location.lng, { shouldValidate: true, shouldDirty: true });
            setIsMapOpen(false);
          }}
        />
      )}
    </>
  );
}
