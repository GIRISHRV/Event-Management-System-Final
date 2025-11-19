// Define your Supabase database types here
// This file helps with type safety when querying your database

export type Profile = {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
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

  // Venue and location details
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_landmark?: string;
  venue_type?: 'indoor' | 'outdoor' | 'hybrid';
  google_maps_url?: string;
  venue_latitude?: number;
  venue_longitude?: number;

  // Organizer information
  organizer_name?: string;
  organizer_contact?: string;
  organizer_email?: string;

  // Complex data stored as JSON arrays
  schedules?: EventScheduleData[];
  performers?: EventPerformerData[];
  faqs?: EventFAQData[];
  tags?: string[];
  gallery_images?: string[];
  gallery_videos?: string[];

  // Timestamps
  created_at: string;
  updated_at: string;

  // Legacy/computed fields for backward compatibility
  event_highlights?: string[];
  key_attractions?: string[];
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

export type CreateEventInput = Omit<
  Event,
  "id" | "created_at" | "updated_at"
>;

// Legacy types for backward compatibility (now stored as JSON within events)
export type EventSchedule = EventScheduleData;
export type EventPerformer = EventPerformerData;
export type EventFAQ = EventFAQData;

export type EventWithDetails = Event;

// Location-based search types
export type EventLocation = {
  event_id: string;
  event_name: string;
  distance_km: number;
};

// Chat history types
export interface ChatHistoryMessage {
  id: string;
  type: 'user' | 'bot' | 'error';
  content: string;
  source?: 'local' | 'AI' | 'web';
  responseTime?: number;
  timestamp?: string;
}

export interface ChatHistory {
  id: string;
  user_id: string;
  event_id: string;
  messages: ChatHistoryMessage[];
  created_at: string;
  updated_at: string;
}

export type Booking = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'confirmed' | 'cancelled' | 'waitlist';
  created_at: string;
};

// Add more types as needed based on your database schema
