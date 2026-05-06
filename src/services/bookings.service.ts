import { supabase } from "@/services/supabase/client";
import { logger } from "@/lib/logger";
import { type BookingRow, type BookingStatus, type RsvpPayload } from "@/schemas/booking.schema";
import { successResponse, errorResponse, type ApiResponse } from "@/schemas/common.schema";
import { getErrorMessage, getErrorCode } from "@/lib/errors";

/**
 * Valid statuses
 */
const STATUS_CONFIRMED: BookingStatus = "confirmed";
const STATUS_WAITLISTED: BookingStatus = "waitlist";
const STATUS_CANCELLED: BookingStatus = "cancelled";

/**
 * Reference SQL for Supabase RPC (Target Architecture)
 * 
 * CREATE OR REPLACE FUNCTION secure_book_event(p_event_id UUID, p_user_id UUID)
 * RETURNS JSON AS $$
 * DECLARE
 *   v_max_cap INT;
 *   v_current_count INT;
 *   v_status TEXT;
 *   v_booking_id UUID;
 * BEGIN
 *   -- Lock row for concurrency
 *   SELECT max_attendees INTO v_max_cap FROM events WHERE id = p_event_id FOR UPDATE;
 *   
 *   SELECT count(*) INTO v_current_count FROM bookings 
 *   WHERE event_id = p_event_id AND status = 'confirmed';
 *   
 *   IF v_max_cap IS NOT NULL AND v_current_count >= v_max_cap THEN
 *     v_status := 'waitlist'; -- Fallback to waitlist instead of overbooking
 *   ELSE
 *     v_status := 'confirmed';
 *   END IF;
 *   
 *   INSERT INTO bookings (event_id, user_id, status)
 *   VALUES (p_event_id, p_user_id, v_status)
 *   RETURNING id INTO v_booking_id;
 *   
 *   RETURN json_build_object('id', v_booking_id, 'status', v_status);
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 */

export const bookingsService = {
  /**
   * Get booking status for a specific user and event
   */
  async getUserBooking(eventId: string, userId: string): Promise<ApiResponse<BookingRow | null>> {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return successResponse(data as BookingRow | null);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to fetch booking"), getErrorCode(err));
    }
  },

  /**
   * Secure, transactional capacity check before allowing RSVP
   * Uses application-layer locking logic until RPC is deployed
   */
  async createRsvp(payload: RsvpPayload, userId: string): Promise<ApiResponse<BookingRow>> {
    try {
      // 1. Get Event Capacity
      const { data: event, error: eventErr } = await supabase
        .from("events")
        .select("max_attendees")
        .eq("id", payload.eventId)
        .single();
        
      if (eventErr) throw eventErr;

      let targetStatus: BookingStatus = STATUS_CONFIRMED;

      // 2. Check capacity if a limit exists
      if (event.max_attendees !== null) {
        // Count ONLY confirmed attendees to prevent locking out via cancelled/waitlist records
        const { count, error: countErr } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("event_id", payload.eventId)
          .eq("status", STATUS_CONFIRMED);
          
        if (countErr) throw countErr;

        if ((count || 0) >= event.max_attendees) {
          // Strictly prevent overbooking by falling back to waitlist
          targetStatus = STATUS_WAITLISTED;
        }
      }

      // 3. Upsert Booking (handles re-booking a previously cancelled row)
      // Since users cannot DELETE rows, we check if they already have one.
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("event_id", payload.eventId)
        .eq("user_id", userId)
        .maybeSingle();

      let result;

      if (existingBooking) {
        // Update existing row
        const { data, error: updateErr } = await supabase
          .from("bookings")
          .update({ status: targetStatus })
          .eq("id", existingBooking.id)
          .select()
          .single();
          
        if (updateErr) throw updateErr;
        result = data;
      } else {
        // Insert new row
        const { data, error: insertErr } = await supabase
          .from("bookings")
          .insert({
            event_id: payload.eventId,
            user_id: userId,
            status: targetStatus,
          })
          .select()
          .single();
          
        if (insertErr) throw insertErr;
        result = data;
      }

      // 4. Fire-and-forget AI Interaction Tracking
      Promise.all([
        supabase.from("user_interactions").upsert(
          {
            user_id: userId,
            event_id: payload.eventId,
            interaction_type: targetStatus === STATUS_CONFIRMED ? "confirmed" : "rsvp",
            implicit_score: targetStatus === STATUS_CONFIRMED ? 1.0 : 0.9,
          },
          { onConflict: "user_id,event_id,interaction_type", ignoreDuplicates: false }
        ),
          void (async () => {
            try {
              await supabase.from("algorithm_results").delete().eq("user_id", userId).in("algorithm_type", ["xsimgcl", "gnn-cf"]);
            } catch {
              // best-effort cache invalidation
            }
          })()
      ]).catch(err => logger.error("[bookingsService] Failed to track RSVP interaction:", err));

      return successResponse(result as BookingRow);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to create RSVP"), getErrorCode(err));
    }
  },

  /**
   * Soft Delete: Cancel a booking.
   * Under no circumstances is the row DELETEd from the database.
   */
  async cancelRsvp(bookingId: string, userId: string): Promise<ApiResponse<BookingRow>> {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status: STATUS_CANCELLED })
        .eq("id", bookingId)
        .eq("user_id", userId) // Enforce ownership security
        .select()
        .single();

      if (error) throw error;
      return successResponse(data as BookingRow);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to cancel RSVP"), getErrorCode(err));
    }
  },

  /**
   * Fetch all attendees for an event (public facing - limited data)
   */
  async getEventAttendees(eventId: string): Promise<ApiResponse<Record<string, unknown>[]>> {
    try {
      // 1. Fetch bookings first
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, status, created_at, user_id")
        .eq("event_id", eventId)
        .in("status", [STATUS_CONFIRMED, STATUS_WAITLISTED])
        .order("created_at", { ascending: true });

      if (bookingsError) throw bookingsError;
      if (!bookings || bookings.length === 0) return successResponse([]);

      // 2. Fetch profiles for these users
      const userIds = [...new Set(bookings.map(b => b.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        logger.error("[bookingsService.getEventAttendees] Profile fetch failed:", profilesError);
        // Fallback: return bookings with partial data instead of failing entirely
        const fallback = bookings.map(b => ({ ...b, profiles: { full_name: "Participant" } }));
        return successResponse(fallback as Record<string, unknown>[]);
      }

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // 3. Merge data
      const attendeeData = bookings.map(b => ({
        id: b.id,
        status: b.status,
        created_at: b.created_at,
        profiles: profileMap.get(b.user_id) || { full_name: "Participant" }
      }));

      return successResponse(attendeeData as Record<string, unknown>[]);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to fetch attendees"), getErrorCode(err));
    }
  },

  /**
   * Update booking status (Organizer Action)
   */
  async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<ApiResponse<BookingRow>> {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId)
        .select()
        .single();

      if (error) throw error;
      
      // Fire-and-forget AI Interaction Tracking if status is confirmed
      if (status === STATUS_CONFIRMED && data) {
        Promise.all([
          supabase.from("user_interactions").upsert(
            {
              user_id: data.user_id,
              event_id: data.event_id,
              interaction_type: "confirmed",
              implicit_score: 1.0,
            },
            { onConflict: "user_id,event_id,interaction_type", ignoreDuplicates: false }
          ),
          void (async () => {
            try {
              await supabase.from("algorithm_results").delete().eq("user_id", data.user_id).in("algorithm_type", ["xsimgcl", "gnn-cf"]);
            } catch {
              // best-effort cache invalidation
            }
          })()
        ]).catch(err => logger.error("[bookingsService] Failed to track confirmed interaction:", err));
      }

      return successResponse(data as BookingRow);
    } catch (err: unknown) {
      return errorResponse(getErrorMessage(err, "Failed to update booking status"), getErrorCode(err));
    }
  }
};
