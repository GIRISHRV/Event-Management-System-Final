import { z } from "zod";
import { EVENT_STATUS, VISIBILITY_TYPES, VENUE_TYPES } from "@/lib/constants";

/**
 * Event Schemas — Single Source of Truth
 * 
 * DESIGN GOAL: These schemas support the core event management features
 * including scheduling, capacity management, and location tracking.
 * - Numeric fields (capacity, budget, lat/lng) MUST be numbers, never strings.
 * - Dates must be ISO strings.
 * - Arrays must have strict item shapes.
 */

// ─── Shared Sub-Schemas ──────────────────────────────────────────────────────

export const eventScheduleSchema = z.object({
  id: z.string().uuid().optional(), // optional for new events
  day_number: z.number().int().min(1),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be HH:MM format"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be HH:MM format"),
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  location: z.string(),
});

export const eventPerformerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(), // Consolidating performer_type into a generic role
  bio: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  social_links: z.record(z.string(), z.string().url()).optional(),
});

export const eventFaqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  display_order: z.number().int().min(0),
});

// ─── Base Db Schema (Matching Supabase 'events' table exactly) ───────────────

export const eventRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  user_email: z.string().email(),
  
  // Basic Info
  event_name: z.string().min(3),
  event_description: z.string(),
  event_banner_url: z.string().nullable(),
  visibility_type: z.nativeEnum(VISIBILITY_TYPES).default(VISIBILITY_TYPES.PUBLIC),
  event_status: z.nativeEnum(EVENT_STATUS).default(EVENT_STATUS.UPCOMING),
  tags: z.array(z.string()).default([]),

  // Event Capacity & Budget
  max_attendees: z.number().int().positive().nullable(),
  attendee_count: z.number().int().nonnegative().default(0),
  budget: z.number().nonnegative().nullable(),

  // Schedule & Time
  start_date: z.string(), // YYYY-MM-DD
  start_time: z.string(), // HH:MM
  end_date: z.string(),
  end_time: z.string(),
  timezone: z.string(),

  // Location
  venue_type: z.nativeEnum(VENUE_TYPES).default(VENUE_TYPES.INDOOR),
  venue_name: z.string().nullable(),
  venue_address: z.string().nullable(),
  venue_city: z.string().nullable(),
  venue_landmark: z.string().nullable(),
  venue_latitude: z.number().min(-90).max(90).nullable(),
  venue_longitude: z.number().min(-180).max(180).nullable(),
  google_maps_url: z.string().url().nullable().or(z.literal("")),

  // Organizer
  organizer_name: z.string(),
  organizer_contact: z.string(),
  organizer_email: z.string().email().nullable(),

  // JSONB Arrays
  schedules: z.array(eventScheduleSchema).default([]),
  performers: z.array(eventPerformerSchema).default([]),
  faqs: z.array(eventFaqSchema).default([]),
  gallery_images: z.array(z.string().url()).default([]),
  gallery_videos: z.array(z.string().url()).default([]),

  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type EventRow = z.infer<typeof eventRowSchema>;

// ─── Form Schema (CamelCase frontend representation) ─────────────────────────
// NO .default() — defaults are provided via useForm({ defaultValues }) in EventFormDrawer.
// This ensures z.input === z.output, making zodResolver type inference exact.

export const eventFormBaseSchema = z.object({
  // Basic Info
  eventName: z.string().min(1, "Event name is required"),
  eventDescription: z.string().min(10, "Description must be at least 10 characters"),
  eventBannerUrl: z.string().optional().or(z.literal('')),
  visibilityType: z.nativeEnum(VISIBILITY_TYPES),
  eventStatus: z.nativeEnum(EVENT_STATUS),
  tags: z.array(z.string()),

  // Constraints
  maxAttendees: z.coerce.number().int().positive("Capacity must be positive").nullable().optional(),
  budget: z.coerce.number().nonnegative("Budget cannot be negative").nullable().optional(),

  // Time
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().min(1, "End time is required"),
  timezone: z.string(),

  // Location
  venueType: z.nativeEnum(VENUE_TYPES),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  venueCity: z.string().optional(),
  venueLandmark: z.string().optional(),
  venueLatitude: z.number().nullable(),
  venueLongitude: z.number().nullable(),
  googleMapsUrl: z.string().optional(),

  // Organizer
  organizerName: z.string().min(1, "Organizer name is required"),
  organizerContact: z.string().min(1, "Contact is required"),
  organizerEmail: z.string().email("Invalid email").optional().or(z.literal('')),

  // Arrays
  schedules: z.array(eventScheduleSchema),
  performers: z.array(eventPerformerSchema),
  faqs: z.array(eventFaqSchema),
  galleryImages: z.array(z.string().url()),
  galleryVideos: z.array(z.string().url()),
});

export type EventFormData = z.infer<typeof eventFormBaseSchema>;
