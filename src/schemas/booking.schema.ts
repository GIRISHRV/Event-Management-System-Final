import { z } from "zod";
import { commonApiResponseSchema } from "./common.schema";

// Booking Status Enum - Status transitions for booking management
export const bookingStatusEnum = z.enum(["confirmed", "waitlist", "cancelled"]);
export type BookingStatus = z.infer<typeof bookingStatusEnum>;

// Core Booking Row from Database
export const bookingRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: bookingStatusEnum,
  ticket_tier: z.string().nullable().optional(),
  amount_paid: z.number().nullable().optional(),
  booking_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type BookingRow = z.infer<typeof bookingRowSchema>;

// Booking Payload for Creating/Updating
export const bookingPayloadSchema = z.object({
  eventId: z.string().uuid(),
  ticketTier: z.string().optional(),
  bookingMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type BookingPayload = z.infer<typeof bookingPayloadSchema>;

// RSVP Payload (simplified for the RSVP button)
export const rsvpPayloadSchema = z.object({
  eventId: z.string().uuid(),
});

export type RsvpPayload = z.infer<typeof rsvpPayloadSchema>;

// Booking Status Update Payload (For Cancellations/Soft Deletes)
export const updateBookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: bookingStatusEnum,
});

export type UpdateBookingStatusPayload = z.infer<typeof updateBookingStatusSchema>;

// Booking Response from API
export const apiBookingResponseSchema = commonApiResponseSchema(bookingRowSchema);
export type ApiBookingResponse = z.infer<typeof apiBookingResponseSchema>;

// Booking List Response
export const apiBookingListResponseSchema = commonApiResponseSchema(z.array(bookingRowSchema));
export type ApiBookingListResponse = z.infer<typeof apiBookingListResponseSchema>;
