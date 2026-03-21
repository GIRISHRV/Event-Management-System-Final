import { supabase } from "./supabase/client";
import { EVENT_FULL_QUERY } from "@/lib/constants";
import { type EventRow, type EventFormData } from "@/schemas/event.schema";
import { successResponse, errorResponse, type ApiResponse, type PaginationParams, type PaginatedResponse } from "@/schemas/common.schema";
import { getErrorMessage, getErrorCode } from "@/lib/errors";
import { type ExtendedEventVendor } from "@/lib/supabase-types";

/**
 * Maps frontend EventFormData to database EventRow input format.
 */
function mapToDbFormat(data: EventFormData, userId: string, userEmail: string): Omit<EventRow, "id" | "created_at" | "updated_at" | "attendee_count"> {
  return {
    user_id: userId,
    user_email: userEmail,
    event_name: data.eventName,
    event_description: data.eventDescription,
    event_banner_url: data.eventBannerUrl || null,
    visibility_type: data.visibilityType,
    event_status: data.eventStatus,
    tags: data.tags,
    max_attendees: data.maxAttendees ?? null,
    budget: data.budget ?? null,
    start_date: data.startDate,
    start_time: data.startTime,
    end_date: data.endDate,
    end_time: data.endTime,
    timezone: data.timezone,
    venue_type: data.venueType,
    venue_name: data.venueName || null,
    venue_address: data.venueAddress || null,
    venue_city: data.venueCity || null,
    venue_landmark: data.venueLandmark || null,
    venue_latitude: data.venueLatitude,
    venue_longitude: data.venueLongitude,
    google_maps_url: data.googleMapsUrl || null,
    organizer_name: data.organizerName,
    organizer_contact: data.organizerContact,
    organizer_email: data.organizerEmail || null,
    schedules: data.schedules,
    performers: data.performers,
    faqs: data.faqs,
    gallery_images: data.galleryImages,
    gallery_videos: data.galleryVideos,
  };
}

/**
 * Events Service — Single Data Access Layer for Events
 */
export const eventsService = {
  /**
   * Fetch a single event by ID
   */
  async getEventById(eventId: string): Promise<ApiResponse<EventRow>> {
    try {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_FULL_QUERY)
        .eq("id", eventId)
        .single();

      if (error) throw error;
      return successResponse(data as EventRow);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to fetch event"), getErrorCode(err));
    }
  },

  /**
   * Fetch public events with pagination
   */
  async getPublicEvents(
    params: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<EventRow>>> {
    try {
      const { page, limit } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from("events")
        .select(EVENT_FULL_QUERY, { count: "exact" })
        .eq("visibility_type", "public")
        .order("start_date", { ascending: true })
        .range(from, to);

      if (error) throw error;

      return successResponse({
        items: (data || []) as EventRow[],
        total: count || 0,
        page,
        limit,
        hasMore: (count || 0) > to + 1,
      });
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to fetch public events"), getErrorCode(err));
    }
  },

  /**
   * Fetch events owned by the user
   */
  async getMyEvents(
    userId: string,
    params: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<EventRow>>> {
    try {
      const { page, limit } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from("events")
        .select(EVENT_FULL_QUERY, { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return successResponse({
        items: (data || []) as EventRow[],
        total: count || 0,
        page,
        limit,
        hasMore: (count || 0) > to + 1,
      });
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to fetch your events"), getErrorCode(err));
    }
  },

  /**
   * Create a new event
   */
  async createEvent(
    data: EventFormData,
    userId: string,
    userEmail: string
  ): Promise<ApiResponse<EventRow>> {
    try {
      const dbPayload = mapToDbFormat(data, userId, userEmail);

      const { data: result, error } = await supabase
        .from("events")
        .insert(dbPayload)
        .select(EVENT_FULL_QUERY)
        .single();

      if (error) throw error;
      return successResponse(result as EventRow);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to create event"), getErrorCode(err));
    }
  },

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    data: EventFormData,
    userId: string,
    userEmail: string
  ): Promise<ApiResponse<EventRow>> {
    try {
      const dbPayload = mapToDbFormat(data, userId, userEmail);

      const { data: result, error } = await supabase
        .from("events")
        .update(dbPayload)
        .eq("id", eventId)
        .eq("user_id", userId) // Security: Ensure owner
        .select(EVENT_FULL_QUERY)
        .single();

      if (error) throw error;
      return successResponse(result as EventRow);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to update event"), getErrorCode(err));
    }
  },

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("user_id", userId); // Security: Ensure owner

      if (error) throw error;
      return successResponse(null);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to delete event"), getErrorCode(err));
    }
  },

  /**
   * Fetch formal roster of hired vendors for an event
   */
  async getEventVendors(eventId: string): Promise<ApiResponse<ExtendedEventVendor[]>> {
    try {
      const { data, error } = await supabase
        .from("event_vendors")
        .select(`
          *,
          profiles:vendor_id(full_name, email, avatar_url),
          vendor_services:service_id(service_name, base_price, category)
        `)
        .eq("event_id", eventId);

      if (error) throw error;
      
      return successResponse(data.map(v => ({
        ...v,
        profiles: Array.isArray(v.profiles) ? v.profiles[0] : v.profiles,
        vendor_services: Array.isArray(v.vendor_services) ? v.vendor_services[0] : v.vendor_services
      })) as ExtendedEventVendor[]);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to fetch event vendors"), getErrorCode(err));
    }
  }
};
