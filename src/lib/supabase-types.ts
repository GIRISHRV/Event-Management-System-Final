// Define your Supabase database types here
// This file helps with type safety when querying your database

export type Profile = {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  role: 'customer' | 'vendor' | 'admin';
  created_at: string;
  updated_at?: string;
};

export type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Event = {
  // Primary identifiers
  id: string;
  user_id?: string;
  user_email: string;

  // Basic event information (REQUIRED)
  event_name: string;
  event_description?: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  timezone?: string;

  // Event media and visibility
  event_banner_url?: string;
  visibility_type: 'public' | 'private' | 'whitelist';
  event_status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

  // Event capacity and RSVP management
  max_attendees?: number;
  rsvp_required: boolean;
  rsvp_deadline?: string;
  age_restrictions?: string;

  // Venue and location details
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_state?: string;
  venue_country?: string;
  venue_postal_code?: string;
  venue_landmark?: string;
  venue_type?: 'indoor' | 'outdoor' | 'hybrid';
  google_maps_url?: string;
  venue_latitude?: number;
  venue_longitude?: number;

  // Organizer information
  organizer_name?: string;
  organizer_contact?: string;
  organizer_email?: string;

  // Facilities and amenities (boolean flags)
  parking_available?: boolean;
  food_stalls?: boolean;
  alcohol_available?: boolean;
  wheelchair_access?: boolean;
  kids_allowed?: boolean;
  pets_allowed?: boolean;

  // Complex data stored as JSON arrays
  schedules?: EventScheduleData[];
  performers?: EventPerformerData[];
  vendors?: EventVendorData[];
  faqs?: EventFAQData[];
  safety_guidelines?: string[];
  facilities?: string[];
  invitations?: EventInvitationData[];
  rsvps?: EventRSVPData[];
  tags?: string[];

  // Timestamps
  created_at: string;
  updated_at: string;

  // Legacy/computed fields for backward compatibility
  event_highlights?: string[]; // Can be stored in tags or facilities
  key_attractions?: string[]; // Can be stored in tags or facilities
  latitude?: number; // Maps to venue_latitude
  longitude?: number; // Maps to venue_longitude
  prohibited_items?: string[]; // Can be stored in facilities as negative items
  entry_guidelines?: string; // Can be stored in safety_guidelines
  security_measures?: string; // Can be stored in safety_guidelines
  medical_assistance_info?: string; // Can be stored in safety_guidelines
  weather_advisory?: string; // Can be stored in safety_guidelines
  gallery_images?: string[]; // Can be stored in facilities or separate storage
  gallery_videos?: string[]; // Can be stored in facilities or separate storage
  featured?: boolean; // Can be computed based on event popularity or admin flag
};

// JSON Data Types (stored within events table)
export interface EventScheduleData {
  day_number: number;
  start_time: string;
  end_time: string;
  title: string;
  description?: string;
  location: string;
}

export interface EventPerformerData {
  name: string;
  bio?: string;
  image_url?: string;
  performer_type: 'artist' | 'speaker' | 'chef' | 'performer' | 'other';
  social_links?: Record<string, string>;
}

export interface EventVendorData {
  vendor_name: string;
  vendor_description?: string;
  food_category?: string;
  menu_preview?: string[];
  vendor_contact?: string;
  stall_location?: string;
  image_url?: string;
}

export interface EventFAQData {
  question: string;
  answer: string;
  display_order: number;
}

export interface EventInvitationData {
  invited_email: string;
  invitation_status: 'pending' | 'accepted' | 'declined';
  invited_by: string;
  invited_at: string;
}

export interface EventRSVPData {
  user_email: string;
  status: 'going' | 'not_going' | 'maybe' | 'pending';
  timestamp: string;
  notes?: string;
}

export type CreateEventInput = Omit<
  Event,
  "id" | "created_at" | "updated_at"
>;

// Legacy types for backward compatibility (now stored as JSON within events)
export type EventSchedule = EventScheduleData;
export type EventPerformer = EventPerformerData;
export type EventVendor = EventVendorData;
export type EventFAQ = EventFAQData;
export type EventInvitation = EventInvitationData;
export type EventRSVP = EventRSVPData;

export type EventWithDetails = Event;

export type EventWithAttendeeInfo = Event & {
  attendee_count?: number;
  user_rsvp_status?: string;
  is_full?: boolean;
  schedule_count?: number;
  performer_count?: number;
  vendor_count?: number;
  faq_count?: number;
  going_count?: number;
  total_rsvps?: number;
};

// Location-based search types
export type EventLocation = {
  event_id: string;
  event_name: string;
  distance_km: number;
};

// Add more types as needed based on your database schema
