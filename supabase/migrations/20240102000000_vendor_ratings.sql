-- Migration: Vendor Ratings System
-- Adds: vendor_ratings table, auto-update trigger on vendor_services.rating, event_vendors population fix

-- ?"EUR?"EUR 1. Create vendor_ratings table ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
CREATE TABLE IF NOT EXISTS public.vendor_ratings (
  id               UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  event_id         UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vendor_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id       UUID NOT NULL REFERENCES public.vendor_services(id) ON DELETE CASCADE,
  rater_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating           SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate ratings: one organizer per service per event
  UNIQUE (service_request_id, rater_id)
);

-- ?"EUR?"EUR 2. Row Level Security ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
ALTER TABLE public.vendor_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings (for display purposes)
CREATE POLICY "ratings_select_all"
  ON public.vendor_ratings FOR SELECT
  USING (true);

-- Only the organizer who made the request can insert a rating
CREATE POLICY "ratings_insert_own"
  ON public.vendor_ratings FOR INSERT
  WITH CHECK (auth.uid() = rater_id);

-- ?"EUR?"EUR 3. Trigger: auto-recalculate vendor_services.rating on every new rating ?"EUR?"EUR
CREATE OR REPLACE FUNCTION public.update_vendor_service_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.vendor_services
  SET rating = (
    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
    FROM public.vendor_ratings
    WHERE service_id = NEW.service_id
  )
  WHERE id = NEW.service_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_vendor_service_rating ON public.vendor_ratings;
CREATE TRIGGER trg_update_vendor_service_rating
  AFTER INSERT OR UPDATE ON public.vendor_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_service_rating();

-- ?"EUR?"EUR 4. Add rating column to vendor_services if it doesn't exist ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
ALTER TABLE public.vendor_services ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;

COMMENT ON TABLE public.vendor_ratings IS 'Organizer ratings for vendor services, submitted after event completion. Triggers auto-recalculate of vendor_services.rating for MOEA/D.';
