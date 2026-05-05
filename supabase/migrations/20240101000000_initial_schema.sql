-- ============================================================
-- MAIN SCHEMA ??? EventMS (auto-applied by: npx supabase db reset)
-- Full database schema: tables, types, functions, triggers,
-- indexes, foreign keys, RLS enable, and grants.
-- Dumped from cloud project and used as the canonical schema.
-- Do NOT edit manually ??? make changes via new migration files.
-- ============================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."booking_status" AS ENUM (
    'confirmed',
    'cancelled',
    'waitlist'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."cancellation_party" AS ENUM (
    'customer',
    'vendor'
);


ALTER TYPE "public"."cancellation_party" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'upcoming',
    'ongoing',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."service_request_status" AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."service_request_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'customer',
    'vendor',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."venue_type" AS ENUM (
    'indoor',
    'outdoor',
    'hybrid'
);


ALTER TYPE "public"."venue_type" OWNER TO "postgres";


CREATE TYPE "public"."visibility_type" AS ENUM (
    'public',
    'private',
    'whitelist'
);


ALTER TYPE "public"."visibility_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_near_location"("user_lat" numeric, "user_lng" numeric, "radius_km" integer DEFAULT 50) RETURNS TABLE("event_id" "uuid", "event_name" "text", "distance_km" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.event_name,
    ROUND(
      (6371 * acos(
        cos(radians(user_lat)) * cos(radians(e.venue_latitude)) *
        cos(radians(e.venue_longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(e.venue_latitude))
      ))::DECIMAL, 2
    ) AS distance_km
  FROM public.events e
  WHERE 
    e.venue_latitude IS NOT NULL 
    AND e.venue_longitude IS NOT NULL
    AND e.visibility_type = 'public'
    AND e.event_status = 'upcoming'
    AND (6371 * acos(
      cos(radians(user_lat)) * cos(radians(e.venue_latitude)) *
      cos(radians(e.venue_longitude) - radians(user_lng)) +
      sin(radians(user_lat)) * sin(radians(e.venue_latitude))
    )) <= radius_km
  ORDER BY distance_km;
END;
$$;


ALTER FUNCTION "public"."get_events_near_location"("user_lat" numeric, "user_lng" numeric, "radius_km" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
  -- Never crash signup. Profile can be created by the frontend as fallback.
  RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_request_acceptance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF (NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted')) THEN
        INSERT INTO event_vendors (event_id, vendor_id, service_id, request_id)
        VALUES (NEW.event_id, NEW.vendor_id, NEW.service_id, NEW.id)
        ON CONFLICT (event_id, service_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_request_acceptance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_events"("search_term" "text") RETURNS TABLE("id" "uuid", "event_name" "text", "event_description" "text", "start_date" "date", "venue_city" "text", "rank" real)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.event_name,
    e.event_description,
    e.start_date,
    e.venue_city,
    ts_rank(
      to_tsvector('english', e.event_name || ' ' || COALESCE(e.event_description, '') || ' ' || COALESCE(e.venue_city, '')),
      plainto_tsquery('english', search_term)
    ) AS rank
  FROM public.events e
  WHERE 
    to_tsvector('english', e.event_name || ' ' || COALESCE(e.event_description, '') || ' ' || COALESCE(e.venue_city, ''))
    @@ plainto_tsquery('english', search_term)
    AND e.visibility_type = 'public'
    AND e.event_status = 'upcoming'
  ORDER BY rank DESC, e.start_date ASC;
END;
$$;


ALTER FUNCTION "public"."search_events"("search_term" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_attendee_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- On INSERT of a confirmed booking
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;

  -- On UPDATE: status changed to confirmed
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;

  -- On UPDATE: status changed away from confirmed
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    UPDATE events SET attendee_count = GREATEST(attendee_count - 1, 0) WHERE id = NEW.event_id;

  -- On DELETE of a confirmed booking
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'confirmed' THEN
    UPDATE events SET attendee_count = GREATEST(attendee_count - 1, 0) WHERE id = OLD.event_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_attendee_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::TEXT, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."algorithm_results" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "algorithm_type" "text" NOT NULL,
    "user_id" "uuid",
    "input_data" "jsonb",
    "output_data" "jsonb" NOT NULL,
    "execution_time_ms" numeric,
    "version" "text" DEFAULT '1.0.0'::"text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."algorithm_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "forecast_date" "date" NOT NULL,
    "predicted_attendance" integer NOT NULL,
    "lower_bound" integer NOT NULL,
    "upper_bound" integer NOT NULL,
    "confidence" numeric(3,2) DEFAULT 0.95 NOT NULL,
    "trend" character varying(20),
    "model_version" character varying(20) DEFAULT '1.0.0'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "attendance_forecasts_lower_bound_check" CHECK (("lower_bound" >= 0)),
    CONSTRAINT "attendance_forecasts_predicted_attendance_check" CHECK (("predicted_attendance" >= 0)),
    CONSTRAINT "attendance_forecasts_trend_check" CHECK ((("trend")::"text" = ANY ((ARRAY['increasing'::character varying, 'decreasing'::character varying, 'stable'::character varying])::"text"[]))),
    CONSTRAINT "attendance_forecasts_upper_bound_check" CHECK (("upper_bound" >= 0))
);


ALTER TABLE "public"."attendance_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid",
    "user_id" "uuid",
    "status" "public"."booking_status" DEFAULT 'confirmed'::"public"."booking_status",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "event_id" "uuid",
    "messages" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_communities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "community_id" "text" NOT NULL,
    "event_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "label" character varying,
    "size" integer,
    "density" numeric,
    "modularity" numeric,
    "characteristics" "text"[]
);


ALTER TABLE "public"."event_communities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid",
    "vendor_id" "uuid",
    "service_id" "uuid",
    "request_id" "uuid",
    "hired_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_description" "text",
    "start_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_date" "date" NOT NULL,
    "end_time" time without time zone NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Kolkata'::"text",
    "event_banner_url" "text",
    "visibility_type" "public"."visibility_type" DEFAULT 'public'::"public"."visibility_type",
    "event_status" "public"."event_status" DEFAULT 'upcoming'::"public"."event_status",
    "max_attendees" integer,
    "attendee_count" integer DEFAULT 0,
    "budget" numeric,
    "venue_name" "text",
    "venue_address" "text",
    "venue_city" "text",
    "venue_landmark" "text",
    "venue_type" "public"."venue_type",
    "google_maps_url" "text",
    "venue_latitude" numeric,
    "venue_longitude" numeric,
    "organizer_name" "text",
    "organizer_contact" "text",
    "organizer_email" "text",
    "schedules" "jsonb" DEFAULT '[]'::"jsonb",
    "performers" "jsonb" DEFAULT '[]'::"jsonb",
    "faqs" "jsonb" DEFAULT '[]'::"jsonb",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "gallery_images" "text"[] DEFAULT '{}'::"text"[],
    "gallery_videos" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_trending" boolean DEFAULT false
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "role" "public"."user_role" DEFAULT 'customer'::"public"."user_role",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recently_viewed" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "event_id" "uuid",
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recently_viewed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid",
    "service_id" "uuid",
    "requester_id" "uuid",
    "vendor_id" "uuid",
    "status" "public"."service_request_status" DEFAULT 'pending'::"public"."service_request_status",
    "message" "text",
    "cancellation_requested_by" "public"."cancellation_party",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "interaction_type" character varying(20) NOT NULL,
    "implicit_score" numeric(3,2) DEFAULT 0.5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vendor_service_id" "uuid",
    "split" "text",
    CONSTRAINT "user_interactions_interaction_type_check" CHECK ((("interaction_type")::"text" = ANY ((ARRAY['view'::character varying, 'favorite'::character varying, 'rsvp'::character varying, 'ticket_click'::character varying, 'booking'::character varying, 'vendor_view'::character varying, 'recommendation_click'::character varying, 'confirmed'::character varying, 'not_interested'::character varying])::"text"[]))),
    CONSTRAINT "user_interactions_split_check" CHECK (("split" = ANY (ARRAY['train'::"text", 'val'::"text", 'test'::"text"])))
);


ALTER TABLE "public"."user_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "vendor_id" "uuid",
    "service_name" "text" NOT NULL,
    "description" "text",
    "base_price" numeric,
    "price_unit" "text",
    "category" "text",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "quality_score" numeric,
    "rating" numeric,
    "capacity" integer
);


ALTER TABLE "public"."vendor_services" OWNER TO "postgres";


ALTER TABLE ONLY "public"."algorithm_results"
    ADD CONSTRAINT "algorithm_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_forecasts"
    ADD CONSTRAINT "attendance_forecasts_event_id_forecast_date_key" UNIQUE ("event_id", "forecast_date");



ALTER TABLE ONLY "public"."attendance_forecasts"
    ADD CONSTRAINT "attendance_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_communities"
    ADD CONSTRAINT "event_communities_community_id_key" UNIQUE ("community_id");



ALTER TABLE ONLY "public"."event_communities"
    ADD CONSTRAINT "event_communities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_event_id_service_id_key" UNIQUE ("event_id", "service_id");



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."recently_viewed"
    ADD CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recently_viewed"
    ADD CONSTRAINT "recently_viewed_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_user_event_type_unique" UNIQUE ("user_id", "event_id", "interaction_type");



ALTER TABLE ONLY "public"."vendor_services"
    ADD CONSTRAINT "vendor_services_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_algo_results_type" ON "public"."algorithm_results" USING "btree" ("algorithm_type");



CREATE INDEX "idx_algo_results_user_id" ON "public"."algorithm_results" USING "btree" ("user_id");



CREATE INDEX "idx_algo_results_user_type" ON "public"."algorithm_results" USING "btree" ("user_id", "algorithm_type");



CREATE INDEX "idx_bookings_event_id" ON "public"."bookings" USING "btree" ("event_id");



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_events_name_trgm" ON "public"."events" USING "gin" ("event_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("event_status");



CREATE INDEX "idx_events_user_id" ON "public"."events" USING "btree" ("user_id");



CREATE INDEX "idx_events_visibility" ON "public"."events" USING "btree" ("visibility_type");



CREATE INDEX "idx_forecasts_date" ON "public"."attendance_forecasts" USING "btree" ("event_id", "forecast_date" DESC);



CREATE INDEX "idx_forecasts_event" ON "public"."attendance_forecasts" USING "btree" ("event_id");



CREATE INDEX "idx_profiles_username" ON "public"."profiles" USING "btree" ("username");



CREATE UNIQUE INDEX "idx_recently_viewed_upsert" ON "public"."recently_viewed" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_service_requests_requester" ON "public"."service_requests" USING "btree" ("requester_id");



CREATE INDEX "idx_service_requests_vendor" ON "public"."service_requests" USING "btree" ("vendor_id");



CREATE INDEX "idx_user_interactions_event" ON "public"."user_interactions" USING "btree" ("event_id");



CREATE INDEX "idx_user_interactions_type" ON "public"."user_interactions" USING "btree" ("user_id", "interaction_type");



CREATE UNIQUE INDEX "idx_user_interactions_upsert" ON "public"."user_interactions" USING "btree" ("user_id", "event_id", "interaction_type");



CREATE INDEX "idx_user_interactions_user" ON "public"."user_interactions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "set_chat_history_updated_at" BEFORE UPDATE ON "public"."chat_history" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_service_requests_updated_at" BEFORE UPDATE ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_vendor_services_updated_at" BEFORE UPDATE ON "public"."vendor_services" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_handle_request_acceptance" AFTER UPDATE ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_request_acceptance"();



CREATE OR REPLACE TRIGGER "tr_update_attendee_count" AFTER INSERT OR DELETE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_attendee_count"();



CREATE OR REPLACE TRIGGER "trg_attendee_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_attendee_count"();



ALTER TABLE ONLY "public"."algorithm_results"
    ADD CONSTRAINT "algorithm_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_forecasts"
    ADD CONSTRAINT "attendance_forecasts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."vendor_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recently_viewed"
    ADD CONSTRAINT "recently_viewed_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recently_viewed"
    ADD CONSTRAINT "recently_viewed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."vendor_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_vendor_service_id_fkey" FOREIGN KEY ("vendor_service_id") REFERENCES "public"."vendor_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_services"
    ADD CONSTRAINT "vendor_services_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins manage attendance_forecasts" ON "public"."attendance_forecasts" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role"));



CREATE POLICY "Admins manage user_interactions" ON "public"."user_interactions" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role"));



CREATE POLICY "Admins view all user_interactions" ON "public"."user_interactions" FOR SELECT USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role"));



CREATE POLICY "Customers create service requests" ON "public"."service_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Event vendors viewable by event owner and vendor" ON "public"."event_vendors" FOR SELECT USING ((("auth"."uid"() = "vendor_id") OR (EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_vendors"."event_id") AND ("events"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Organizer can read own event forecasts" ON "public"."attendance_forecasts" FOR SELECT USING (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can delete own events" ON "public"."events" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Organizers can insert events" ON "public"."events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Organizers can update own events" ON "public"."events" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owners view event bookings" ON "public"."bookings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "bookings"."event_id") AND ("events"."user_id" = "auth"."uid"())))));



CREATE POLICY "Parties can delete requests" ON "public"."service_requests" FOR DELETE USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "vendor_id")));



CREATE POLICY "Parties update requests" ON "public"."service_requests" FOR UPDATE USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "vendor_id")));



CREATE POLICY "Parties view their requests" ON "public"."service_requests" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "vendor_id")));



CREATE POLICY "Public events viewable by everyone" ON "public"."events" FOR SELECT USING ((("visibility_type" = 'public'::"public"."visibility_type") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public view event communities" ON "public"."event_communities" FOR SELECT USING (true);



CREATE POLICY "Service can insert forecasts" ON "public"."attendance_forecasts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service can update forecasts" ON "public"."attendance_forecasts" FOR UPDATE USING (true);



CREATE POLICY "Services viewable by everyone" ON "public"."vendor_services" FOR SELECT USING (true);



CREATE POLICY "Users can delete own bookings" ON "public"."bookings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own chat history" ON "public"."chat_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own interactions" ON "public"."user_interactions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own interactions" ON "public"."user_interactions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own chat history" ON "public"."chat_history" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own interactions" ON "public"."user_interactions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own chat history" ON "public"."chat_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users create own bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own interactions" ON "public"."user_interactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own favorites" ON "public"."favorites" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own history" ON "public"."recently_viewed" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own bookings" ON "public"."bookings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own interactions" ON "public"."user_interactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Vendors manage own services" ON "public"."vendor_services" USING (("auth"."uid"() = "vendor_id"));



ALTER TABLE "public"."attendance_forecasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_communities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recently_viewed" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_services" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_events_near_location"("user_lat" numeric, "user_lng" numeric, "radius_km" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_near_location"("user_lat" numeric, "user_lng" numeric, "radius_km" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_near_location"("user_lat" numeric, "user_lng" numeric, "radius_km" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_request_acceptance"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_request_acceptance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_request_acceptance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_events"("search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_events"("search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_events"("search_term" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_attendee_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_attendee_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_attendee_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."algorithm_results" TO "anon";
GRANT ALL ON TABLE "public"."algorithm_results" TO "authenticated";
GRANT ALL ON TABLE "public"."algorithm_results" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."attendance_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."chat_history" TO "anon";
GRANT ALL ON TABLE "public"."chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_history" TO "service_role";



GRANT ALL ON TABLE "public"."event_communities" TO "anon";
GRANT ALL ON TABLE "public"."event_communities" TO "authenticated";
GRANT ALL ON TABLE "public"."event_communities" TO "service_role";



GRANT ALL ON TABLE "public"."event_vendors" TO "anon";
GRANT ALL ON TABLE "public"."event_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."event_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recently_viewed" TO "anon";
GRANT ALL ON TABLE "public"."recently_viewed" TO "authenticated";
GRANT ALL ON TABLE "public"."recently_viewed" TO "service_role";



GRANT ALL ON TABLE "public"."service_requests" TO "anon";
GRANT ALL ON TABLE "public"."service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."user_interactions" TO "anon";
GRANT ALL ON TABLE "public"."user_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_services" TO "anon";
GRANT ALL ON TABLE "public"."vendor_services" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_services" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


































-- ============================================================
-- Merged from: 20240102000000_fix_rls_performance.sql
-- ============================================================
-- ============================================================
-- RLS PERFORMANCE FIXES
-- Fixes 3 categories of linter warnings:
--   1. auth_rls_initplan   ??????EUR? wrap auth.uid() in (select auth.uid())
--   2. multiple_permissive_policies ??????EUR? merge duplicate policies per table/action
--   3. duplicate_index     ??????EUR? drop redundant indexes
-- ============================================================


-- ============================================================
-- 1. DROP ALL AFFECTED POLICIES (we recreate them below)
-- ============================================================

-- attendance_forecasts
DROP POLICY IF EXISTS "Admins manage attendance_forecasts"       ON public.attendance_forecasts;
DROP POLICY IF EXISTS "Organizer can read own event forecasts"   ON public.attendance_forecasts;
DROP POLICY IF EXISTS "Service can insert forecasts"             ON public.attendance_forecasts;
DROP POLICY IF EXISTS "Service can update forecasts"             ON public.attendance_forecasts;

-- user_interactions (has the most duplicates)
DROP POLICY IF EXISTS "Admins manage user_interactions"          ON public.user_interactions;
DROP POLICY IF EXISTS "Admins view all user_interactions"        ON public.user_interactions;
DROP POLICY IF EXISTS "Users can insert own interactions"        ON public.user_interactions;
DROP POLICY IF EXISTS "Users can read own interactions"          ON public.user_interactions;
DROP POLICY IF EXISTS "Users can update own interactions"        ON public.user_interactions;
DROP POLICY IF EXISTS "Users insert own interactions"            ON public.user_interactions;
DROP POLICY IF EXISTS "Users view own interactions"              ON public.user_interactions;

-- bookings
DROP POLICY IF EXISTS "Owners view event bookings"               ON public.bookings;
DROP POLICY IF EXISTS "Users view own bookings"                  ON public.bookings;
DROP POLICY IF EXISTS "Users create own bookings"                ON public.bookings;
DROP POLICY IF EXISTS "Users can delete own bookings"            ON public.bookings;

-- vendor_services
DROP POLICY IF EXISTS "Services viewable by everyone"            ON public.vendor_services;
DROP POLICY IF EXISTS "Vendors manage own services"              ON public.vendor_services;

-- service_requests
DROP POLICY IF EXISTS "Customers create service requests"        ON public.service_requests;
DROP POLICY IF EXISTS "Parties can delete requests"              ON public.service_requests;
DROP POLICY IF EXISTS "Parties update requests"                  ON public.service_requests;
DROP POLICY IF EXISTS "Parties view their requests"              ON public.service_requests;

-- events
DROP POLICY IF EXISTS "Public events viewable by everyone"       ON public.events;
DROP POLICY IF EXISTS "Organizers can delete own events"         ON public.events;
DROP POLICY IF EXISTS "Organizers can insert events"             ON public.events;
DROP POLICY IF EXISTS "Organizers can update own events"         ON public.events;

-- event_vendors
DROP POLICY IF EXISTS "Event vendors viewable by event owner and vendor" ON public.event_vendors;

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile"             ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"             ON public.profiles;

-- favorites
DROP POLICY IF EXISTS "Users manage own favorites"               ON public.favorites;

-- recently_viewed
DROP POLICY IF EXISTS "Users manage own history"                 ON public.recently_viewed;

-- chat_history
DROP POLICY IF EXISTS "Users can insert own chat history"        ON public.chat_history;
DROP POLICY IF EXISTS "Users can update own chat history"        ON public.chat_history;
DROP POLICY IF EXISTS "Users can view own chat history"          ON public.chat_history;


-- ============================================================
-- 2. RECREATE POLICIES ??????EUR? all auth.uid() wrapped in (select ...)
--    + duplicate policies merged into single ones
-- ============================================================

-- ???EUR???????EUR???? attendance_forecasts ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????
-- FIX: merge "Admins manage" + "Service can insert/update" into
--      a single permissive policy per action (INSERT/UPDATE/SELECT/DELETE)
--      Admin check uses (select auth.uid()) for initplan fix.

CREATE POLICY "attendance_forecasts_select"
  ON public.attendance_forecasts FOR SELECT
  USING (
    -- Admins see all
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
    OR
    -- Organizers see their own event forecasts
    event_id IN (
      SELECT id FROM public.events WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "attendance_forecasts_insert"
  ON public.attendance_forecasts FOR INSERT
  WITH CHECK (
    -- Admins or service role can insert
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
    OR true  -- "Service can insert forecasts" was WITH CHECK (true)
  );

CREATE POLICY "attendance_forecasts_update"
  ON public.attendance_forecasts FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
    OR true  -- "Service can update forecasts" was USING (true)
  );

CREATE POLICY "attendance_forecasts_delete"
  ON public.attendance_forecasts FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );


-- ???EUR???????EUR???? user_interactions ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????
-- FIX: had 3 INSERT, 4 SELECT, 2 UPDATE overlapping policies
--      merged into 1 per action

CREATE POLICY "user_interactions_select"
  ON public.user_interactions FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "user_interactions_insert"
  ON public.user_interactions FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "user_interactions_update"
  ON public.user_interactions FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "user_interactions_delete"
  ON public.user_interactions FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );


-- ???EUR???????EUR???? bookings ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????
-- FIX: "Owners view event bookings" + "Users view own bookings" merged

CREATE POLICY "bookings_select"
  ON public.bookings FOR SELECT
  USING (
    -- User sees their own bookings
    user_id = (SELECT auth.uid())
    OR
    -- Event organizer sees all bookings for their event
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = bookings.event_id
        AND events.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "bookings_insert"
  ON public.bookings FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "bookings_delete"
  ON public.bookings FOR DELETE
  USING (user_id = (SELECT auth.uid()));


-- ???EUR???????EUR???? vendor_services ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????
-- FIX: "Services viewable by everyone" + "Vendors manage own services" SELECT merged

CREATE POLICY "vendor_services_select"
  ON public.vendor_services FOR SELECT
  USING (true);  -- public read; vendor write covered below

CREATE POLICY "vendor_services_insert"
  ON public.vendor_services FOR INSERT
  WITH CHECK (vendor_id = (SELECT auth.uid()));

CREATE POLICY "vendor_services_update"
  ON public.vendor_services FOR UPDATE
  USING (vendor_id = (SELECT auth.uid()));

CREATE POLICY "vendor_services_delete"
  ON public.vendor_services FOR DELETE
  USING (vendor_id = (SELECT auth.uid()));


-- ???EUR???????EUR???? service_requests ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????

CREATE POLICY "service_requests_select"
  ON public.service_requests FOR SELECT
  USING (
    (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = vendor_id
  );

CREATE POLICY "service_requests_insert"
  ON public.service_requests FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = requester_id);

CREATE POLICY "service_requests_update"
  ON public.service_requests FOR UPDATE
  USING (
    (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = vendor_id
  );

CREATE POLICY "service_requests_delete"
  ON public.service_requests FOR DELETE
  USING (
    (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = vendor_id
  );


-- ???EUR???????EUR???? events ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????

CREATE POLICY "events_select"
  ON public.events FOR SELECT
  USING (
    visibility_type = 'public'
    OR (SELECT auth.uid()) = user_id
  );

CREATE POLICY "events_insert"
  ON public.events FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "events_update"
  ON public.events FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "events_delete"
  ON public.events FOR DELETE
  USING ((SELECT auth.uid()) = user_id);


-- ???EUR???????EUR???? event_vendors ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????

CREATE POLICY "event_vendors_select"
  ON public.event_vendors FOR SELECT
  USING (
    (SELECT auth.uid()) = vendor_id
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_vendors.event_id
        AND events.user_id = (SELECT auth.uid())
    )
  );


-- ???EUR???????EUR???? profiles ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????

CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id);


-- ???EUR???????EUR???? favorites ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????

CREATE POLICY "favorites_all"
  ON public.favorites
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);


-- ???EUR???????EUR???? recently_viewed ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????

CREATE POLICY "recently_viewed_all"
  ON public.recently_viewed
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);


-- ???EUR???????EUR???? chat_history ???EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR???????EUR????

CREATE POLICY "chat_history_select"
  ON public.chat_history FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "chat_history_insert"
  ON public.chat_history FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "chat_history_update"
  ON public.chat_history FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);


-- ============================================================
-- 3. DROP DUPLICATE INDEXES
-- ============================================================

-- recently_viewed: idx_recently_viewed_upsert duplicates recently_viewed_user_id_event_id_key
--   Keep the UNIQUE CONSTRAINT (recently_viewed_user_id_event_id_key), drop the extra index
DROP INDEX IF EXISTS public.idx_recently_viewed_upsert;

-- user_interactions: idx_user_interactions_upsert duplicates user_interactions_user_event_type_unique
--   Keep the UNIQUE CONSTRAINT, drop the extra index
DROP INDEX IF EXISTS public.idx_user_interactions_upsert;


-- ============================================================
-- Merged from: 20240103000000_add_fk_indexes.sql
-- ============================================================
-- ============================================================
-- ADD MISSING FOREIGN KEY INDEXES
-- Fixes unindexed_foreign_keys linter warnings
-- ============================================================

-- chat_history
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id  ON public.chat_history (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_event_id ON public.chat_history (event_id);

-- event_vendors
CREATE INDEX IF NOT EXISTS idx_event_vendors_vendor_id    ON public.event_vendors (vendor_id);
CREATE INDEX IF NOT EXISTS idx_event_vendors_service_id   ON public.event_vendors (service_id);
CREATE INDEX IF NOT EXISTS idx_event_vendors_request_id   ON public.event_vendors (request_id);

-- favorites (event_id; user_id already covered by unique constraint favorites_user_id_event_id_key)
CREATE INDEX IF NOT EXISTS idx_favorites_event_id ON public.favorites (event_id);

-- recently_viewed (event_id; user_id already covered by unique constraint)
CREATE INDEX IF NOT EXISTS idx_recently_viewed_event_id ON public.recently_viewed (event_id);

-- service_requests
CREATE INDEX IF NOT EXISTS idx_service_requests_event_id   ON public.service_requests (event_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_id ON public.service_requests (service_id);

-- user_interactions
CREATE INDEX IF NOT EXISTS idx_user_interactions_vendor_service_id ON public.user_interactions (vendor_service_id);

-- vendor_services
CREATE INDEX IF NOT EXISTS idx_vendor_services_vendor_id ON public.vendor_services (vendor_id);


-- ============================================================
-- Merged from: 20240104000000_algorithm_results_rls.sql
-- ============================================================
-- ============================================================
-- ENABLE RLS ON algorithm_results + ADD POLICIES
-- ============================================================

ALTER TABLE public.algorithm_results ENABLE ROW LEVEL SECURITY;

-- Users can read their own ML results
CREATE POLICY "algorithm_results_select"
  ON public.algorithm_results FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- Only admins can insert/update/delete via anon/authenticated role
-- (ML pipeline uses service_role key which bypasses RLS entirely)
CREATE POLICY "algorithm_results_insert"
  ON public.algorithm_results FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "algorithm_results_update"
  ON public.algorithm_results FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "algorithm_results_delete"
  ON public.algorithm_results FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

