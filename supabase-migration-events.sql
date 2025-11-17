-- Migration: Update events table to remove organizer fields
-- This script removes the old organizer fields and keeps the new schema

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can read their own events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;

-- Option 1: If you have no data or want to start fresh, drop and recreate
-- DROP TABLE IF EXISTS public.events CASCADE;

-- Option 2: If you have data, alter the table to remove old columns
-- Remove old columns if they exist
ALTER TABLE public.events DROP COLUMN IF EXISTS organizer_name CASCADE;
ALTER TABLE public.events DROP COLUMN IF EXISTS organizer_email CASCADE;
ALTER TABLE public.events DROP COLUMN IF EXISTS organizer_phone CASCADE;
ALTER TABLE public.events DROP COLUMN IF EXISTS attachments CASCADE;

-- Ensure the table has the correct structure
-- Add columns if they don't exist
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_name TEXT NOT NULL DEFAULT 'Unnamed Event';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_description TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '09:00';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TIME NOT NULL DEFAULT '17:00';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_banner_url TEXT;

-- Remove defaults after adding columns (they were just for initial rows)
ALTER TABLE public.events ALTER COLUMN event_name DROP DEFAULT;
ALTER TABLE public.events ALTER COLUMN start_date DROP DEFAULT;
ALTER TABLE public.events ALTER COLUMN start_time DROP DEFAULT;
ALTER TABLE public.events ALTER COLUMN end_date DROP DEFAULT;
ALTER TABLE public.events ALTER COLUMN end_time DROP DEFAULT;

-- Re-enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Users can read their own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- Recreate indexes
DROP INDEX IF EXISTS idx_events_user_id;
DROP INDEX IF EXISTS idx_events_created_at;

CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);
