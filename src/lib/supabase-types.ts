// Define your Supabase database types here
// This file helps with type safety when querying your database

export type Profile = {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
};

export type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Event = {
  id: string;
  user_id: string;
  event_name: string;
  event_description?: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  timezone?: string;
  event_banner_url?: string;
  created_at: string;
  updated_at: string;
};

export type CreateEventInput = Omit<
  Event,
  "id" | "user_id" | "created_at" | "updated_at"
>;

// Add more types as needed based on your database schema
