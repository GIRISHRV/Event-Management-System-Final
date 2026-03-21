-- #16 Idempotent DB Fixes for Audit

-- 1. Update user_interactions CHECK constraint
ALTER TABLE user_interactions DROP CONSTRAINT IF EXISTS user_interactions_interaction_type_check;
ALTER TABLE user_interactions ADD CONSTRAINT user_interactions_interaction_type_check 
    CHECK (interaction_type IN ('view', 'favorite', 'rsvp', 'ticket_click', 'booking', 'vendor_view', 'recommendation_click', 'confirmed'));

-- 2. Add vendor_service_id to user_interactions
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS vendor_service_id UUID REFERENCES vendor_services(id) ON DELETE CASCADE;

-- 3. Add quality_score to vendor_services
ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS quality_score NUMERIC DEFAULT 1.0;

-- 4. Fix event_communities table
DROP TABLE IF EXISTS event_communities;
CREATE TABLE event_communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id TEXT NOT NULL,
    event_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id)
);

-- 5. Add attendee_count to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 0;
