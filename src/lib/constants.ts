/**
 * Application Constants — Single Source of Truth
 *
 * RULES:
 * 1. Visual constants (colors, spacing, shadows) belong in globals.css @theme.
 *    Do NOT define CSS values here.
 * 2. This file is for LOGIC-ONLY constants: enums, query strings, limits, config.
 * 3. Layout pixel values are defined here ONLY for JS calculations (e.g. sticky offsets).
 *    The CSS equivalents live in globals.css @theme.
 */

// ─── Supabase Storage ────────────────────────────────────────────────────────

export const STORAGE_BUCKETS = {
  EVENT_BANNERS: "event-banners",
  AVATARS: "avatars",
} as const;

// ─── Layout (JS-side pixel values, synced with globals.css @theme) ───────────

export const LAYOUT = {
  /** Navbar height in pixels — synced with --navbar-height: 3.5rem (56px) */
  NAVBAR_HEIGHT: 56,
  /** Sidebar width in pixels — synced with --sidebar-width */
  SIDEBAR_WIDTH: 256,
  /** Sidebar collapsed width — synced with --sidebar-collapsed-width */
  SIDEBAR_COLLAPSED_WIDTH: 64,
} as const;

// ─── Event Enums ─────────────────────────────────────────────────────────────

export const EVENT_STATUS = {
  UPCOMING: "upcoming",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const VISIBILITY_TYPES = {
  PUBLIC: "public",
  PRIVATE: "private",
  WHITELIST: "whitelist",
} as const;

export const VENUE_TYPES = {
  INDOOR: "indoor",
  OUTDOOR: "outdoor",
  HYBRID: "hybrid",
} as const;

export const BOOKING_STATUS = {
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  WAITLIST: "waitlist",
} as const;

// ─── Defaults ────────────────────────────────────────────────────────────────

/** Default map center — India */
export const DEFAULT_COORDINATES = {
  lat: 20.5937,
  lng: 78.9629,
} as const;

// ─── AI / Chat ──────────────────────────────────────────────────────

/** Default AI model when HF_MODEL env var is not set */
export const DEFAULT_HF_MODEL = "meta-llama/Llama-3.3-70B-Instruct";

/** AI request timeout in milliseconds */
export const HF_TIMEOUT_MS = 120_000;

// ─── Pagination & Limits ─────────────────────────────────────────────────────

/** Events shown per page in public event lists */
export const EVENTS_PER_PAGE = 9;

/** Maximum chat history messages fetched per event */
export const MAX_CHAT_HISTORY = 20;

/** Minimum loading screen display time (ms) — prevents flash */
export const MIN_LOADING_TIME_MS = 300;

// ─── Database Queries ────────────────────────────────────────────────────────

/**
 * Standard event select query — used by ALL event fetchers.
 * If you need to add a column, add it HERE so it propagates everywhere.
 */
export const EVENT_FULL_QUERY = `
  id, user_id, user_email, event_name, event_description,
  start_date, start_time, end_date, end_time, timezone,
  event_banner_url, visibility_type, event_status, max_attendees, attendee_count, budget,
  venue_name, venue_address, venue_city, venue_landmark, venue_type,
  venue_latitude, venue_longitude, google_maps_url,
  organizer_name, organizer_contact, organizer_email,
  schedules, performers, faqs, gallery_images, gallery_videos, tags,
  created_at, updated_at
` as const;
