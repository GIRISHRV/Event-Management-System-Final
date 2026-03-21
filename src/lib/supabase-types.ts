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
  event_description?: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  timezone?: string;

  // Event media and visibility
  event_banner_url?: string | null;
  visibility_type: 'public' | 'private' | 'whitelist';
  event_status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

  // Event capacity and RSVP management
  max_attendees?: number | null;

  // Budget
  budget?: number | null;

  // Venue and location details
  venue_name?: string | null;
  venue_address?: string | null;
  venue_city?: string | null;
  venue_landmark?: string | null;
  venue_type?: 'indoor' | 'outdoor' | 'hybrid' | null;
  google_maps_url?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;

  // Organizer information
  organizer_name?: string | null;
  organizer_contact?: string | null;
  organizer_email?: string | null;

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
  id?: string;
  role?: string;
  bio?: string;
  image_url?: string;
  performer_type?: 'artist' | 'speaker' | 'chef' | 'performer' | 'other';
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

// Legacy type aliases removed — use EventScheduleData, EventPerformerData, EventFAQData, Event directly.


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

export type VendorService = {
  id: string;
  vendor_id: string;
  service_name: string;
  description?: string;
  base_price?: number;
  price_unit?: string;
  category?: string;
  images?: string[];
  created_at: string;
  updated_at?: string;
};

export type ServiceRequest = {
  id: string;
  event_id: string;
  service_id: string;
  requester_id: string;
  vendor_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  message?: string;
  /** Set when one party initiates a cancellation. Cleared when accepted or declined. */
  cancellation_requested_by?: 'customer' | 'vendor' | null;
  created_at: string;
  updated_at?: string;
};

// Shared join type used by DashboardRequestsList (customer & vendor views)
export type ExtendedServiceRequest = ServiceRequest & {
  events: {
    event_name: string;
    start_date: string;
  };
  vendor_services: {
    service_name: string;
    base_price: number;
  };
  profiles: {
    full_name: string;
    email: string;
  };
};

export type EventVendor = {
  id: string;
  event_id: string;
  vendor_id: string;
  service_id: string;
  request_id: string;
  hired_at: string;
};

export type ExtendedEventVendor = EventVendor & {
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  vendor_services: {
    service_name: string;
    base_price: number;
    category: string;
  };
};
