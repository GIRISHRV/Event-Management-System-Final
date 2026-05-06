import useSWR from "swr";
import { bookingsService } from "@/services/bookings.service";
import { useAuth } from "@/context/AuthContext";
import { type BookingStatus } from "@/schemas/booking.schema";

export interface AttendeeProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface Attendee {
  id: string;
  status: BookingStatus;
  created_at: string;
  profiles: AttendeeProfile | null;
}

export function useBookings(eventId?: string) {
  const { session, userProfile } = useAuth();
  const userId = session?.user?.id;
  const isVendor = userProfile?.role === "vendor";

  /**
   * Fetch logic for the current user's RSVP to the specific event
   */
  const userBookingKey = eventId && userId && !isVendor ? ["booking", eventId, userId] : null;
  
  const { 
    data: userBookingResponse, 
    error: userBookingError, 
    isLoading: isBookingLoading,
    mutate: mutateUserBooking
  } = useSWR(
    userBookingKey,
    async () => {
      const response = await bookingsService.getUserBooking(eventId as string, userId as string);
      if (!response.success) throw new Error(response.error?.message);
      return response.data; // BookingRow | null
    },
    { revalidateOnFocus: true }
  );

  /**
   * Fetch logic for public attendees list
   */
  const attendeesKey = eventId ? ["attendees", eventId] : null;
  
  const {
    data: attendeesResponse,
    error: attendeesError,
    isLoading: isAttendeesLoading,
    mutate: mutateAttendees
  } = useSWR(
    attendeesKey,
    async () => {
      const response = await bookingsService.getEventAttendees(eventId as string);
      if (!response.success) throw new Error(response.error?.message);
      return response.data as unknown as Attendee[];
    },
    { revalidateOnFocus: false } // Less critical to refresh constantly
  );

  /**
   * Action methods wrapped in SWR mutations
   */
  const rsvpToEvent = async () => {
    if (!eventId || !userId) return;
    try {
      // Optimistic update
      mutateUserBooking(
        { id: "temp", event_id: eventId, user_id: userId, status: "waitlist" as BookingStatus, created_at: new Date().toISOString() }, 
        false
      );

      const response = await bookingsService.createRsvp({ eventId }, userId);
      if (!response.success) throw new Error(response.error?.message);

      // Revalidate actual server state
      mutateUserBooking();
      mutateAttendees();
      return response.data;
    } catch (err) {
      mutateUserBooking(); // rollback
      throw err;
    }
  };

  const cancelRsvp = async (bookingId: string) => {
    if (!eventId || !userId) return;
    try {
      // Optimistic cancellation update
      mutateUserBooking(
        { id: bookingId, event_id: eventId, user_id: userId, status: "cancelled" as BookingStatus, created_at: new Date().toISOString() }, 
        false
      );

      const response = await bookingsService.cancelRsvp(bookingId, userId);
      if (!response.success) throw new Error(response.error?.message);

      // Revalidate actual server state
      mutateUserBooking();
      mutateAttendees();
      return response.data;
    } catch (err) {
      mutateUserBooking(); // rollback
      throw err;
    }
  };

  return {
    // Current User's Booking State
    userBooking: userBookingResponse || null,
    isBookingLoading,
    userBookingError,
    
    // Overall Event Attendees
    attendees: (attendeesResponse || []) as Attendee[],
    isAttendeesLoading,
    attendeesError,
    
    // Actions
    rsvpToEvent,
    cancelRsvp,
  };
}
