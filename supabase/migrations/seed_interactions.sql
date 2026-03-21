-- ============================================================================
-- AI EVALUATION SEED SCRIPT
-- Generates 300 synthetic users and over 3,000 interactions for paper evaluation
-- ============================================================================

DO $$ 
DECLARE
  v_user_count INT := 300;
  i INT;
  new_uid UUID;
  evt_ids UUID[];
  ven_ids UUID[];
  target_evt UUID;
  target_ven UUID;
  num_ints INT;
  j INT;
  rand_val FLOAT;
  i_type TEXT;
  i_weight NUMERIC;
  v_created TIMESTAMPTZ;
BEGIN
  -- 0. Clean up any previous seeded evaluation users to ensure a clean slate
  -- (Always do explicit drops on both auth and public schemas just in case they are orphaned)
  DELETE FROM public.profiles WHERE username LIKE 'evaluser_%';
  DELETE FROM auth.users WHERE email LIKE 'evaluser_%@example.com';

  -- 1. Cache existing event and vendor IDs to map interactions against real data
  SELECT array_agg(id) INTO evt_ids FROM events;
  SELECT array_agg(id) INTO ven_ids FROM vendor_services;

  IF array_length(evt_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'Cannot seed interactions: No events exist in the database.';
  END IF;

  RAISE NOTICE 'Starting generation of % synthetic users...', v_user_count;

  -- 2. Generate Users and Interactions
  FOR i IN 1..v_user_count LOOP
    new_uid := uuid_generate_v4();
    
    -- A. Safely inject into auth.users 
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      new_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
      'evaluser_' || i || '@example.com', '', NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb, 
      ('{"role":"customer","username":"evaluser_' || i || '"}')::jsonb, 
      NOW(), NOW(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    -- Explicitly insert profile (in case auth trigger is disabled or delayed)
    INSERT INTO public.profiles (id, email, username, full_name, role, created_at, updated_at)
    VALUES (
      new_uid,
      'evaluser_' || i || '@example.com',
      'evaluser_' || i,
      'Eval User ' || i,
      'customer',
      NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- B. Generate a realistic volume of interactions (5 to 20 per user)
    num_ints := floor(random() * 16) + 5; 
    
    FOR j IN 1..num_ints LOOP
      target_evt := evt_ids[floor(random() * array_length(evt_ids, 1)) + 1];
      
      -- Only fetch vendor if they exist
      IF ven_ids IS NOT NULL THEN
        target_ven := ven_ids[floor(random() * array_length(ven_ids, 1)) + 1];
      ELSE
        target_ven := NULL;
      END IF;

      -- Distribute timestamps randomly over the past 90 days to simulate organic growth
      v_created := NOW() - (random() * interval '90 days');
      rand_val := random();
      
      -- Distribution: 50% views, 20% favorites, 10% vendor views, 5% RSVPs, 15% confirmed
      IF rand_val < 0.50 THEN
        i_type := 'view'; i_weight := 0.3;
      ELSIF rand_val < 0.70 THEN
        i_type := 'favorite'; i_weight := 0.7;
      ELSIF rand_val < 0.80 THEN
        i_type := 'vendor_view'; i_weight := 0.2;
      ELSIF rand_val < 0.85 THEN
        i_type := 'rsvp'; i_weight := 0.9;
      ELSE
        i_type := 'confirmed'; i_weight := 1.0;
        
        -- If confirmed, we MUST also create a booking row for evaluation ground truth
        INSERT INTO bookings (event_id, user_id, status, created_at)
        VALUES (target_evt, new_uid, 'confirmed', v_created)
        ON CONFLICT DO NOTHING;
      END IF;

      -- Write the implicit interaction signal (ignore if randomly generated duplicate)
      INSERT INTO user_interactions (user_id, event_id, vendor_service_id, interaction_type, implicit_score, created_at)
      VALUES (
        new_uid, 
        target_evt, 
        CASE WHEN i_type = 'vendor_view' THEN target_ven ELSE NULL END, 
        i_type, 
        i_weight, 
        v_created
      ) ON CONFLICT (user_id, event_id, interaction_type) DO NOTHING;
    END LOOP;
  END LOOP;
  
  -- 3. Sync the attendee counts for the new bookings
  WITH booking_counts AS (
      SELECT event_id, COUNT(*) as new_attendees
      FROM bookings
      WHERE status = 'confirmed'
      GROUP BY event_id
  )
  UPDATE events e
  SET attendee_count = e.attendee_count + bc.new_attendees
  FROM booking_counts bc
  WHERE e.id = bc.event_id;

  RAISE NOTICE 'Seeding complete. Ready for Phase 1 Baseline Evaluation.';

END $$;
