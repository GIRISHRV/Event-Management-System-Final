-- Idempotent Master Database Script for Event Management System
-- Combines Schema, Functions, Triggers, RLS, Storage, and Seed Data.

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 2. ENUMS
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_type') THEN
        CREATE TYPE visibility_type AS ENUM ('public', 'private', 'whitelist');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
        CREATE TYPE event_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_type') THEN
        CREATE TYPE venue_type AS ENUM ('indoor', 'outdoor', 'hybrid');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'waitlist');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_request_status') THEN
        CREATE TYPE service_request_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cancellation_party') THEN
        CREATE TYPE cancellation_party AS ENUM ('customer', 'vendor');
    END IF;
END $$;

-- ============================================================================
-- 3. CORE FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. TABLES
-- ============================================================================
-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role user_role DEFAULT 'customer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_description TEXT,
    start_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_date DATE NOT NULL,
    end_time TIME NOT NULL,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    event_banner_url TEXT,
    visibility_type visibility_type DEFAULT 'public',
    event_status event_status DEFAULT 'upcoming',
    max_attendees INTEGER,
    attendee_count INTEGER DEFAULT 0,
    budget NUMERIC,
    venue_name TEXT,
    venue_address TEXT,
    venue_city TEXT,
    venue_landmark TEXT,
    venue_type venue_type,
    google_maps_url TEXT,
    venue_latitude NUMERIC,
    venue_longitude NUMERIC,
    organizer_name TEXT,
    organizer_contact TEXT,
    organizer_email TEXT,
    schedules JSONB DEFAULT '[]'::jsonb,
    performers JSONB DEFAULT '[]'::jsonb,
    faqs JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}',
    gallery_images TEXT[] DEFAULT '{}',
    gallery_videos TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat History
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status booking_status DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Services
CREATE TABLE IF NOT EXISTS vendor_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC,
    price_unit TEXT,
    category TEXT,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service Requests
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    service_id UUID REFERENCES vendor_services(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status service_request_status DEFAULT 'pending',
    message TEXT,
    cancellation_requested_by cancellation_party,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Vendors (Roster)
CREATE TABLE IF NOT EXISTS event_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    service_id UUID REFERENCES vendor_services(id) ON DELETE CASCADE,
    request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
    hired_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, service_id)
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Recently Viewed
CREATE TABLE IF NOT EXISTS recently_viewed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(event_status);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility_type);
CREATE INDEX IF NOT EXISTS idx_events_name_trgm ON events USING gin (event_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_requester ON service_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_vendor ON service_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ============================================================================
-- 6. TRIGGERS & LOGIC
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_profiles_updated_at') THEN
        CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_events_updated_at') THEN
        CREATE TRIGGER set_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_chat_history_updated_at') THEN
        CREATE TRIGGER set_chat_history_updated_at BEFORE UPDATE ON chat_history FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_vendor_services_updated_at') THEN
        CREATE TRIGGER set_vendor_services_updated_at BEFORE UPDATE ON vendor_services FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_service_requests_updated_at') THEN
        CREATE TRIGGER set_service_requests_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;

-- Attendee Count (Only confirmed)
CREATE OR REPLACE FUNCTION update_attendee_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status = 'confirmed') THEN
            UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
            UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
        ELSIF (OLD.status = 'confirmed' AND NEW.status != 'confirmed') THEN
            UPDATE events SET attendee_count = attendee_count - 1 WHERE id = NEW.event_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.status = 'confirmed') THEN
            UPDATE events SET attendee_count = attendee_count - 1 WHERE id = OLD.event_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_attendee_count ON bookings;
CREATE TRIGGER tr_update_attendee_count AFTER INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION update_attendee_count();

-- Auto-hire vendor
CREATE OR REPLACE FUNCTION handle_request_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted')) THEN
        INSERT INTO event_vendors (event_id, vendor_id, service_id, request_id)
        VALUES (NEW.event_id, NEW.vendor_id, NEW.service_id, NEW.id)
        ON CONFLICT (event_id, service_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_handle_request_acceptance ON service_requests;
CREATE TRIGGER tr_handle_request_acceptance AFTER UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION handle_request_acceptance();

-- Profile Creation on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    CASE
      WHEN new.raw_user_meta_data->>'role' = 'vendor' THEN 'vendor'::user_role
      WHEN new.raw_user_meta_data->>'role' = 'admin'  THEN 'admin'::user_role
      ELSE 'customer'::user_role
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profile backfill for existing auth users who might be missing it
INSERT INTO public.profiles (id, email, username, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  CASE
    WHEN u.raw_user_meta_data->>'role' = 'vendor' THEN 'vendor'::user_role
    ELSE 'customer'::user_role
  END
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

-- Helper to safely recreate policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
    CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
    
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Public events viewable by everyone" ON events;
    CREATE POLICY "Public events viewable by everyone" ON events FOR SELECT USING (visibility_type = 'public' OR auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Organizers can insert events" ON events;
    CREATE POLICY "Organizers can insert events" ON events FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Organizers can update own events" ON events;
    CREATE POLICY "Organizers can update own events" ON events FOR UPDATE USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Organizers can delete own events" ON events;
    CREATE POLICY "Organizers can delete own events" ON events FOR DELETE USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can view own chat history" ON chat_history;
    CREATE POLICY "Users can view own chat history" ON chat_history FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert own chat history" ON chat_history;
    CREATE POLICY "Users can insert own chat history" ON chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update own chat history" ON chat_history;
    CREATE POLICY "Users can update own chat history" ON chat_history FOR UPDATE USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users view own bookings" ON bookings;
    CREATE POLICY "Users view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Owners view event bookings" ON bookings;
    CREATE POLICY "Owners view event bookings" ON bookings FOR SELECT USING (EXISTS (SELECT 1 FROM events WHERE events.id = bookings.event_id AND events.user_id = auth.uid()));
    
    DROP POLICY IF EXISTS "Users create own bookings" ON bookings;
    CREATE POLICY "Users create own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete own bookings" ON bookings;
    CREATE POLICY "Users can delete own bookings" ON bookings FOR DELETE USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Services viewable by everyone" ON vendor_services;
    CREATE POLICY "Services viewable by everyone" ON vendor_services FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Vendors manage own services" ON vendor_services;
    CREATE POLICY "Vendors manage own services" ON vendor_services FOR ALL USING (auth.uid() = vendor_id);

    DROP POLICY IF EXISTS "Parties view their requests" ON service_requests;
    CREATE POLICY "Parties view their requests" ON service_requests FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = vendor_id);
    
    DROP POLICY IF EXISTS "Customers create service requests" ON service_requests;
    CREATE POLICY "Customers create service requests" ON service_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
    
    DROP POLICY IF EXISTS "Parties update requests" ON service_requests;
    CREATE POLICY "Parties update requests" ON service_requests FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = vendor_id);
    
    DROP POLICY IF EXISTS "Parties can delete requests" ON service_requests;
    CREATE POLICY "Parties can delete requests" ON service_requests FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = vendor_id);

    DROP POLICY IF EXISTS "Event vendors viewable by event owner and vendor" ON event_vendors;
    CREATE POLICY "Event vendors viewable by event owner and vendor" ON event_vendors FOR SELECT USING (auth.uid() = vendor_id OR EXISTS (SELECT 1 FROM events WHERE events.id = event_vendors.event_id AND events.user_id = auth.uid()));

    DROP POLICY IF EXISTS "Users manage own favorites" ON favorites;
    CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users manage own history" ON recently_viewed;
    CREATE POLICY "Users manage own history" ON recently_viewed FOR ALL USING (auth.uid() = user_id);
END $$;

-- ============================================================================
-- 8. STORAGE
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true), ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'events'));

    DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
    CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('avatars', 'events') AND auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
    CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE USING (bucket_id IN ('avatars', 'events') AND (auth.uid())::text = (storage.foldername(name))[1]);
END $$;

-- ============================================================================
-- 9. SEED DATA (MOCK CONTENT)
-- ============================================================================
-- Customer: Alice (Event Organizer)
INSERT INTO profiles (id, full_name, email, role, avatar_url)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Alice Organizer', 'alice@example.com', 'customer', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

-- Vendor: Bob (Caterer)
INSERT INTO profiles (id, full_name, email, role, avatar_url)
VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Bob the Caterer', 'bob@example.com', 'vendor', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

-- Vendor: Charlie (Photographer)
INSERT INTO profiles (id, full_name, email, role, avatar_url)
VALUES ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Charlie Photo', 'charlie@example.com', 'vendor', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

-- Mock Events owned by Alice
INSERT INTO events (id, user_id, user_email, event_name, event_description, start_date, start_time, end_date, end_time, venue_name, venue_city, venue_latitude, venue_longitude, organizer_name, organizer_email, event_status)
VALUES 
('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'alice@example.com', 'Summer Gala 2026', 'A beautiful summer evening gala under the stars.', '2026-07-15', '18:00', '2026-07-15', '23:00', 'Central Park Terrace', 'New York', 40.785091, -73.968285, 'Alice Organizer', 'alice@example.com', 'upcoming'),
('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'alice@example.com', 'Tech Networking Night', 'Connect with the brightest minds in tech.', '2026-08-20', '19:00', '2026-08-20', '22:00', 'Innovation Hub', 'San Francisco', 37.774929, -122.419416, 'Alice Organizer', 'alice@example.com', 'upcoming')
ON CONFLICT (id) DO NOTHING;

-- Vendor Services
INSERT INTO vendor_services (id, vendor_id, service_name, description, category, base_price, price_unit)
VALUES 
('s1eebc99-9c0b-4ef8-bb6d-6bb9bd380s01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Gourmet Catering Trio', 'Three-course meal inspired by Mediterranean cuisine.', 'catering', 4500.00, 'per_event'),
('s1eebc99-9c0b-4ef8-bb6d-6bb9bd380s02', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Premium Wedding Photography', 'Full day coverage with professional editing and 500+ photos.', 'photography', 2500.00, 'per_day')
ON CONFLICT (id) DO NOTHING;

-- Service Requests
INSERT INTO service_requests (id, requester_id, vendor_id, service_id, event_id, status, message)
VALUES 
('r1eebc99-9c0b-4ef8-bb6d-6bb9bd380r01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 's1eebc99-9c0b-4ef8-bb6d-6bb9bd380s01', 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'accepted', 'Please cater our Summer Gala!'),
('r1eebc99-9c0b-4ef8-bb6d-6bb9bd380r02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 's1eebc99-9c0b-4ef8-bb6d-6bb9bd380s02', 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'pending', 'Are you available for photography?')
ON CONFLICT (id) DO NOTHING;

-- Event Vendors Handshake
INSERT INTO event_vendors (event_id, vendor_id, service_id, request_id)
VALUES 
('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380e01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 's1eebc99-9c0b-4ef8-bb6d-6bb9bd380s01', 'r1eebc99-9c0b-4ef8-bb6d-6bb9bd380r01')
ON CONFLICT (event_id, service_id) DO NOTHING;

-- ============================================================================
-- 10. DYNAMIC SEED (RELIABLE DATA)
-- ============================================================================
DO $$
DECLARE
    target_customer_id UUID;
    target_customer_email TEXT;
    target_vendor_id UUID;
    new_event_id UUID := 'e1eebc99-9c1b-4ef8-bb6d-6bb9bd380e01';
    new_service_id UUID := 'f1eebc99-9c1b-4ef8-bb6d-6bb9bd380f01';
    new_request_id UUID := 'd1eebc99-9c1b-4ef8-bb6d-6bb9bd380d01';
BEGIN
    SELECT id, email INTO target_customer_id, target_customer_email FROM profiles WHERE role = 'customer' LIMIT 1;
    SELECT id INTO target_vendor_id FROM profiles WHERE role = 'vendor' LIMIT 1;

    IF target_customer_id IS NOT NULL AND target_vendor_id IS NOT NULL THEN
        INSERT INTO events (id, user_id, user_email, event_name, event_description, start_date, start_time, end_date, end_time, venue_name, venue_city, venue_latitude, venue_longitude, organizer_name, organizer_email, event_status)
        VALUES (new_event_id, target_customer_id, target_customer_email, 'Reliable Test Gala', 'A seeded event for flow verification.', '2026-10-10', '19:00', '2026-10-10', '23:00', 'Seeded Plaza', 'Seeded City', 12.9716, 77.5946, 'Test Organizer', 'test@example.com', 'upcoming')
        ON CONFLICT (id) DO UPDATE SET 
            event_name = EXCLUDED.event_name,
            event_description = EXCLUDED.event_description,
            user_email = EXCLUDED.user_email;

        INSERT INTO vendor_services (id, vendor_id, service_name, description, category, base_price, price_unit)
        VALUES (new_service_id, target_vendor_id, 'Pro Seeding Service', 'A mock service to test the pro team roster.', 'photography', 999.00, 'per_event')
        ON CONFLICT (id) DO UPDATE SET 
            service_name = EXCLUDED.service_name,
            base_price = EXCLUDED.base_price,
            price_unit = EXCLUDED.price_unit;

        INSERT INTO service_requests (id, requester_id, vendor_id, service_id, event_id, status, message)
        VALUES (new_request_id, target_customer_id, target_vendor_id, new_service_id, new_event_id, 'accepted', 'Automated seed request.')
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

        INSERT INTO event_vendors (event_id, vendor_id, service_id, request_id)
        VALUES (new_event_id, target_vendor_id, new_service_id, new_request_id)
        ON CONFLICT (event_id, service_id) DO UPDATE SET hired_at = NOW();
    END IF;
END $$;

-- ============================================================================
-- 11. AI / ALGORITHM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS algorithm_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    algorithm_type TEXT NOT NULL,
    output_data JSONB NOT NULL,
    execution_time_ms NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_algo_results_type ON algorithm_results(algorithm_type);

CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    vendor_service_id UUID REFERENCES vendor_services(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL,
    implicit_score NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_interactions_interaction_type_check 
        CHECK (interaction_type IN ('view', 'favorite', 'rsvp', 'ticket_click', 'booking', 'vendor_view', 'recommendation_click', 'confirmed'))
);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_event_id ON user_interactions(event_id);

CREATE TABLE IF NOT EXISTS event_communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id TEXT NOT NULL,
    event_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id)
);
