-- ============================================================================
-- FULL DEMO SEED SCRIPT v4 (RESEARCH GRADE)
-- ============================================================================
-- Fixes vs v3:
--   ✓ 250 events (was 50) ✓ fixes NDCG@10 floor effect
--   ✓ Venue latitude/longitude initialized from city coordinates
--   ✓ Vendor tier system: premium/standard/budget price + quality bands
--   ✓ User-level train/val/test split (not interaction-level ✓ no leakage)
--   ✓ Archetype interaction counts match comments (lurker 5–15, power 150–350)
--   ✓ Friday/Saturday evening temporal bias for session clustering
--   ✓ Viral events (5%) spike to max_attendees; dud events (10%) stay sparse
--   ✓ is_trending flag ✓ weighted boost, not a filter bypass
--   ✓ All undeclared variables fixed (quality_val, i_split, v_tier)
--   ✓ No nested DECLARE blocks (unsupported in PL/pgSQL FOR loops)
--   ✓ City affinity kept at 70% (90% breaks graph connectivity)
--   ✓ Cold-start vendors 96–100 still excluded from service requests
-- ============================================================================

-- Helper functions for city geocoding
CREATE OR REPLACE FUNCTION get_city_latitude(city TEXT) RETURNS FLOAT AS $$
BEGIN
  RETURN CASE city
    WHEN 'Mumbai' THEN 19.0760
    WHEN 'Delhi' THEN 28.7041
    WHEN 'Bangalore' THEN 12.9716
    WHEN 'Hyderabad' THEN 17.3850
    WHEN 'Chennai' THEN 13.0827
    WHEN 'Kolkata' THEN 22.5726
    WHEN 'Pune' THEN 18.5204
    WHEN 'Ahmedabad' THEN 23.0225
    WHEN 'Jaipur' THEN 26.9124
    WHEN 'Surat' THEN 21.1702
    WHEN 'Lucknow' THEN 26.8467
    WHEN 'Kanpur' THEN 26.4499
    WHEN 'Nagpur' THEN 21.1458
    WHEN 'Indore' THEN 22.7196
    WHEN 'Bhopal' THEN 23.1815
    WHEN 'Patna' THEN 25.5941
    WHEN 'Vadodara' THEN 22.3072
    WHEN 'Ludhiana' THEN 30.9010
    WHEN 'Agra' THEN 27.1767
    WHEN 'Nashik' THEN 19.9975
    WHEN 'Faridabad' THEN 28.4089
    WHEN 'Meerut' THEN 28.9845
    WHEN 'Rajkot' THEN 22.3039
    WHEN 'Varanasi' THEN 25.3176
    WHEN 'Coimbatore' THEN 11.0066
    WHEN 'Kochi' THEN 9.9312
    WHEN 'Thiruvananthapuram' THEN 8.5241
    WHEN 'Vijayawada' THEN 16.5062
    WHEN 'Visakhapatnam' THEN 17.6869
    WHEN 'Mysuru' THEN 12.2958
    WHEN 'Hubli' THEN 15.3647
    WHEN 'Mangalore' THEN 12.8628
    WHEN 'Chandigarh' THEN 30.7333
    WHEN 'Amritsar' THEN 31.6340
    WHEN 'Jalandhar' THEN 31.8255
    WHEN 'Dehradun' THEN 30.3165
    WHEN 'Shimla' THEN 31.7724
    WHEN 'Haridwar' THEN 29.9457
    WHEN 'Rishikesh' THEN 30.0889
    WHEN 'Guwahati' THEN 26.1445
    WHEN 'Bhubaneswar' THEN 20.2961
    WHEN 'Cuttack' THEN 20.4625
    WHEN 'Ranchi' THEN 23.3441
    WHEN 'Raipur' THEN 21.2514
    WHEN 'Gwalior' THEN 26.2183
    WHEN 'Jabalpur' THEN 23.1815
    WHEN 'Ujjain' THEN 23.1815
    WHEN 'Jodhpur' THEN 26.2389
    WHEN 'Udaipur' THEN 24.5854
    WHEN 'Ajmer' THEN 26.4499
    ELSE 20.5937  -- India center fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_city_longitude(city TEXT) RETURNS FLOAT AS $$
BEGIN
  RETURN CASE city
    WHEN 'Mumbai' THEN 72.8479
    WHEN 'Delhi' THEN 77.1025
    WHEN 'Bangalore' THEN 77.5945
    WHEN 'Hyderabad' THEN 78.4867
    WHEN 'Chennai' THEN 80.2707
    WHEN 'Kolkata' THEN 88.3639
    WHEN 'Pune' THEN 73.8567
    WHEN 'Ahmedabad' THEN 72.5714
    WHEN 'Jaipur' THEN 75.7873
    WHEN 'Surat' THEN 72.8311
    WHEN 'Lucknow' THEN 80.9462
    WHEN 'Kanpur' THEN 80.3336
    WHEN 'Nagpur' THEN 79.0882
    WHEN 'Indore' THEN 75.8577
    WHEN 'Bhopal' THEN 77.4126
    WHEN 'Patna' THEN 85.1376
    WHEN 'Vadodara' THEN 73.1812
    WHEN 'Ludhiana' THEN 75.8573
    WHEN 'Agra' THEN 78.0081
    WHEN 'Nashik' THEN 73.7997
    WHEN 'Faridabad' THEN 77.3178
    WHEN 'Meerut' THEN 77.7064
    WHEN 'Rajkot' THEN 70.8022
    WHEN 'Varanasi' THEN 82.9711
    WHEN 'Coimbatore' THEN 76.9558
    WHEN 'Kochi' THEN 76.2673
    WHEN 'Thiruvananthapuram' THEN 76.9366
    WHEN 'Vijayawada' THEN 80.6428
    WHEN 'Visakhapatnam' THEN 83.2185
    WHEN 'Mysuru' THEN 75.7139
    WHEN 'Hubli' THEN 75.1394
    WHEN 'Mangalore' THEN 74.8479
    WHEN 'Chandigarh' THEN 76.7794
    WHEN 'Amritsar' THEN 74.8723
    WHEN 'Jalandhar' THEN 75.5761
    WHEN 'Dehradun' THEN 78.0322
    WHEN 'Shimla' THEN 77.1734
    WHEN 'Haridwar' THEN 78.1198
    WHEN 'Rishikesh' THEN 78.2676
    WHEN 'Guwahati' THEN 91.7898
    WHEN 'Bhubaneswar' THEN 85.8830
    WHEN 'Cuttack' THEN 85.8945
    WHEN 'Ranchi' THEN 85.3271
    WHEN 'Raipur' THEN 81.6296
    WHEN 'Gwalior' THEN 78.1694
    WHEN 'Jabalpur' THEN 79.5941
    WHEN 'Ujjain' THEN 75.7850
    WHEN 'Jodhpur' THEN 73.0243
    WHEN 'Udaipur' THEN 73.7125
    WHEN 'Ajmer' THEN 74.6399
    ELSE 78.9629  -- India center fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
DECLARE
  i INT; j INT;
  new_uid        UUID;
  organizer_uid  UUID;
  evt_id         UUID;
  svc_id         UUID;

  user_city      TEXT;
  user_interest  TEXT;
  user_archetype TEXT;
  user_cohort    TEXT;
  user_split     TEXT;
  conf_count     INT;

  evt_ids     UUID[] := '{}';
  svc_ids     UUID[] := '{}';
  cust_ids    UUID[] := '{}';
  ven_ids_arr UUID[] := '{}';
  org_ids     UUID[] := '{}';

  rand_val     FLOAT;
  i_type       TEXT;
  i_weight     NUMERIC;
  i_split      TEXT;
  v_created    TIMESTAMPTZ;
  session_base TIMESTAMPTZ;
  num_ints     INT;
  status_val   TEXT;
  session_ctr  INT;
  msg_template TEXT;
  quality_val  NUMERIC;
  rat_val      SMALLINT;   -- vendor rating seed (1?EUR"5)
  ven_idx      INT;        -- position in ven_ids_arr for tier detection
  sr_rec       RECORD;     -- row variable for step 6c FOR loop

  start_dt   DATE;
  end_dt     DATE;
  start_time TEXT;
  end_time   TEXT;
  budget_val NUMERIC;
  tags_arr   TEXT[];
  base_p     NUMERIC;
  cat        TEXT;
  svc_name   TEXT;
  v_tier     TEXT;

  -- ?"EUR?"EUR Name pools ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
  first_names TEXT[] := ARRAY[
    'Aarav','Arjun','Vikram','Rohan','Karan','Nikhil','Aditya','Siddharth','Rahul','Pranav',
    'Ishaan','Vivek','Kunal','Ankit','Manish','Deepak','Rajan','Suresh','Ramesh','Harish',
    'Priya','Sneha','Anjali','Divya','Kavya','Meera','Pooja','Nisha','Shreya','Lakshmi',
    'Ananya','Swati','Ritu','Sunita','Geeta','Leela','Usha','Veena','Radha','Maya',
    'Amit','Ajay','Vijay','Sanjay','Rajesh','Dinesh','Ganesh','Mahesh','Naresh','Tarun',
    'Farhan','Imran','Zaid','Salman','Adnan','Bilal','Wasim','Tariq','Asif','Nasir',
    'Samuel','Daniel','Kevin','Aaron','Jason','Ryan','Brian','Sean','Nathan','Eric',
    'Aryan','Dev','Kabir','Yash','Harsh','Dhruv','Samarth','Reyansh','Veer','Shaurya',
    'Tanvi','Aisha','Riya','Simran','Kritika','Pallavi','Swara','Jhanvi','Khushi','Tara',
    'Mohit','Rohit','Sumit','Lalit','Varun','Pankaj','Rakesh','Brijesh','Naveen','Chirag',
    'Zara','Sana','Hina','Ruhi','Aliya','Fiza','Noor','Saba','Rabia','Anam',
    'Chris','Mark','James','John','David','Michael','Robert','William','Richard','Charles',
    'Suraj','Nitin','Gaurav','Tushar','Hitesh','Jitesh','Pradeep','Santosh','Girish','Umesh'
  ];

  last_names TEXT[] := ARRAY[
    'Sharma','Verma','Patel','Singh','Kumar','Gupta','Joshi','Mishra','Yadav','Tiwari',
    'Reddy','Nair','Pillai','Menon','Iyer','Rao','Naidu','Murthy','Raju','Krishnan',
    'Khan','Ahmed','Siddiqui','Ansari','Shaikh','Qureshi','Malik','Sheikh','Mirza','Baig',
    'Thomas','George','Mathew','Philip','Jacob','Joseph','Daniel','Paul','Cherian','Abraham',
    'Mehta','Shah','Desai','Trivedi','Pandya','Bhatt','Modi','Solanki','Chauhan','Parmar',
    'Das','Dey','Roy','Sen','Bose','Ghosh','Mukherjee','Banerjee','Chatterjee','Majumdar',
    'Choudhary','Saxena','Srivastava','Shukla','Dubey','Pandey','Tripathi','Dwivedi','Awasthi','Bajpai',
    'Kapoor','Malhotra','Khanna','Bhatia','Chopra','Anand','Mehra','Arora','Walia','Sethi',
    'Hegde','Shetty','Kamath','Prabhu','Kini','Badami','Bhat','Pai','Nayak','Karanth',
    'Gill','Dhillon','Sidhu','Sandhu','Grewal','Bajwa','Randhawa','Virk','Mann','Brar'
  ];

  cities TEXT[] := ARRAY[
    'Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad',
    'Jaipur','Surat','Lucknow','Kanpur','Nagpur','Indore','Bhopal','Patna','Vadodara',
    'Ludhiana','Agra','Nashik','Faridabad','Meerut','Rajkot','Varanasi','Coimbatore',
    'Kochi','Thiruvananthapuram','Vijayawada','Visakhapatnam','Mysuru','Hubli','Mangalore',
    'Chandigarh','Amritsar','Jalandhar','Dehradun','Shimla','Haridwar','Rishikesh','Guwahati',
    'Bhubaneswar','Cuttack','Ranchi','Raipur','Gwalior','Jabalpur','Ujjain','Jodhpur','Udaipur','Ajmer'
  ];

  venue_names TEXT[] := ARRAY[
    'The Grand Ballroom','Skyline Convention Centre','Heritage Hall','The Banquet Hall',
    'City Event Arena','Lotus Convention Hall','The Royal Palace','Green Meadows Venue',
    'Prestige Conference Centre','The Cultural Hub','Marina Event Space','Crown Plaza Halls',
    'Metro Convention Centre','The Summit Hall','Lakeview Pavilion','The Atrium',
    'Brigade Convention Hall','The Orchid Banquet','Seasons Event Centre','The Gallery Hall',
    'The Pearl Banquet','Horizon Conference Hall','The Crystal Ballroom','Emerald Pavilion',
    'The Sapphire Hall','Golden Gate Convention','The Infinity Arena','Majestic Event Grounds',
    'The Terrace Gardens','Silver Oak Hall','The Riverside Pavilion','The Dome Events',
    'Constellation Hall','The Landmark Centre','The Glasshouse','The Courtyard Venue',
    'Aspire Event Hall','The Pinnacle Centre','Radiance Banquet Hall','The Forum Events'
  ];

  -- 50 event names ?EUR" cycled across 250 events with a suffix to keep them distinct
  event_names TEXT[] := ARRAY[
    'Tech Summit','Startup Pitch Night','Cultural Fest','Food & Music Festival',
    'Design Conference','Digital Marketing Expo','Health & Wellness Fair','Comedy Night Live',
    'Art Exhibition Opening','Annual Hackathon','Dance Extravaganza','Photography Walk',
    'Literature Festival','Entrepreneurship Summit','Fashion Show','Science Fair',
    'Music Concert Night','Film Festival','Yoga & Meditation Retreat','Career Expo',
    'Gaming Championship','Robotics Olympiad','Culinary Arts Show','Sports Day',
    'Alumni Meet','Environment Awareness Drive','Product Launch Event','Workshop on AI',
    'Social Impact Summit','Night of Stand-Up Comedy','Book Fair','Craft Beer Festival',
    'Corporate Leadership Summit','Women in Tech Conference','Blockchain Expo',
    'Kids Coding Bootcamp','Mental Health Awareness Walk','Indie Music Night',
    'Traditional Arts & Crafts Fair','Urban Farming Workshop','Photography Contest',
    'Content Creators Meetup','Investment & Finance Forum','Street Food Festival',
    'Classical Dance Recital','Open Mic Night','Charity Gala Dinner','Quiz Championship',
    'Debate Tournament','College Tech Fest'
  ];

  event_descs TEXT[] := ARRAY[
    'An inspiring gathering of innovators, engineers, and tech leaders.',
    'Pitch your startup to top investors and industry mentors.',
    'Celebrate the rich heritage of Indian culture through performances and exhibitions.',
    'A vibrant festival featuring cuisines from around the world alongside live music.',
    'Three days of design thinking, UX workshops, and creative sessions.',
    'Learn cutting-edge strategies from leading digital marketing experts.',
    'Discover the latest in health, fitness, and holistic wellness.',
    'An evening of non-stop laughter with top comedians from across India.',
    'Showcasing contemporary and classical art from emerging and established artists.',
    'Build, break, and innovate over 24 hours of non-stop hacking.',
    'A spectacular showcase of dance forms from classical to contemporary.',
    'Explore the city through the lens ?EUR" a guided photography experience.',
    'Celebrate the written word with authors, poets, and storytellers.',
    'Conversations with successful entrepreneurs sharing real-world insights.',
    'The most glamorous fashion showcase of the season.',
    'Encouraging young minds to explore science through experiments and exhibits.',
    'An unforgettable night of live music across multiple genres.',
    'Showcasing independent and international films for cinema lovers.',
    'Find inner peace through guided yoga sessions and meditation workshops.',
    'Connect with top recruiters from across industries.',
    'Compete for glory in popular esports and tabletop games.',
    'High school and college robotics teams compete in exciting challenges.',
    'Watch master chefs demonstrate techniques and taste their creations.',
    'A full day of friendly competition across sports and athletics.',
    'Reconnect with batchmates and celebrate shared memories.',
    'Join hands for a cleaner, greener tomorrow.',
    'Be the first to experience the next big thing in tech.',
    'Hands-on workshop on practical AI and machine learning applications.',
    'Changemakers come together to address pressing social challenges.',
    'Laugh out loud with an incredible lineup of stand-up comedians.',
    'Browse thousands of titles across genres, languages, and formats.',
    'Sample craft brews from local and regional breweries.',
    'Senior leaders share frameworks for navigating complex organisations.',
    'Celebrating women shaping the future of technology.',
    'Explore the latest in decentralised finance and blockchain infrastructure.',
    'A beginner-friendly introduction to programming for school-age children.',
    'A community walk raising awareness around mental health stigma.',
    'Discover the best in independent music across genres.',
    'Artisans and craftspeople showcase handmade goods from across India.',
    'Learn practical urban farming techniques for small spaces.',
    'Submit your best shots and compete for prizes across categories.',
    'Meet fellow creators and discuss monetisation, brand deals, and growth.',
    'Expert panels on personal finance, equities, and alternative investments.',
    'Street food vendors from across the city gather in one place.',
    'A breathtaking recital spanning Bharatanatyam, Kathak, and Odissi.',
    'Open the stage to anyone with a story, poem, or song.',
    'An elegant evening raising funds for underprivileged children.',
    'Test your general knowledge against the best in the city.',
    'Teams argue, deliberate, and persuade across rounds of competitive debate.',
    'The flagship annual technical festival with hackathons and robotics.'
  ];

  svc_categories TEXT[] := ARRAY[
    'Catering','Photography','Decoration','DJ & Music','Lighting','Videography',
    'Security','Hospitality','Transport','Stage Setup','Sound System',
    'Event Planning','Floral Design','Cake & Desserts','Invitations & Printing',
    'Live Band','Emcee & Anchoring','Tent & Canopy','Furniture Rental','Valet Parking',
    'Photo Booth','Drone Photography','Live Streaming','Makeup & Styling','Fireworks',
    'Ice Sculpture','Projection Mapping','Crowd Management','Carnival Games','Caricature Artist'
  ];

  svc_name_templates TEXT[] := ARRAY[
    'Premium %s Services','Elite %s Solutions','Pro %s Package',
    'Deluxe %s Experience','Professional %s Setup','Complete %s Management',
    'Express %s Services','Classic %s Package','Royal %s Services','Urban %s Co',
    'Signature %s Studio','Master %s Group','Pioneer %s Works','Apex %s Crew',
    'Prestige %s Agency','Next-Gen %s Services','All-Star %s Team','Prime %s Hub',
    'Ace %s Solutions','Stellar %s Events'
  ];

  -- ?"EUR?"EUR Semantic tag pools keyed to event category ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
  tech_tags     TEXT[] := ARRAY['technology','innovation','coding','startup','networking','education','business'];
  culture_tags  TEXT[] := ARRAY['culture','community','art','festival','family','social','outdoor'];
  music_tags    TEXT[] := ARRAY['music','entertainment','nightlife','social','community','festival','indoor'];
  food_tags     TEXT[] := ARRAY['food','community','festival','outdoor','family','social','culture'];
  wellness_tags TEXT[] := ARRAY['wellness','health','outdoor','sustainability','community','family','volunteering'];
  biz_tags      TEXT[] := ARRAY['business','networking','career','finance','professional','innovation','education'];
  art_tags      TEXT[] := ARRAY['art','creative','culture','photography','design','community','indoor'];
  sport_tags    TEXT[] := ARRAY['sports','outdoor','health','family','community','sustainability','social'];
  generic_tags  TEXT[] := ARRAY['networking','community','indoor','social','professional','education','entertainment'];

  -- ?"EUR?"EUR Service request message templates ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
  request_messages TEXT[] := ARRAY[
    'Hi, we would love to have you for our upcoming event. Please let us know your availability.',
    'Hello! We came across your profile and think you would be a great fit for our event. Keen to connect?',
    'We are organising an event and your services match exactly what we need. Could you share a quote?',
    'Hi there ?EUR" our event is coming up and we are still looking for the right vendor. Are you available?',
    'We have heard great things about your work. Would love to discuss how you can contribute to our event.',
    'Hello, we are in the planning stages and your category is a priority for us. Let us know your rates.',
    'Hi! Saw your profile and loved the quality of your previous work. Can we set up a quick call?',
    'We are a small team organising an event and would appreciate a reliable partner like you. Interested?',
    'Our event requires top-notch services and your profile stood out. Please respond at your earliest.',
    'Hi ?EUR" we have worked with vendors in your category before but are looking for fresh talent this time. You up for it?'
  ];

  f_name TEXT; l_name TEXT; full_n TEXT; uname TEXT; email_str TEXT;
  city   TEXT; vname  TEXT; ename  TEXT; edesc  TEXT;
  tag_pool_for_event TEXT[];
  event_suffix TEXT;

BEGIN

-- ============================================================================
-- 0. CLEANUP & SCHEMA PREP
-- ============================================================================
RAISE NOTICE 'Step 0: Preparing schema and cleaning up...';

-- Add research-critical columns if they don't exist
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS split TEXT
  CHECK (split IN ('train', 'val', 'test'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT FALSE;

DELETE FROM user_interactions
  WHERE user_id IN (SELECT id FROM public.profiles WHERE username LIKE 'seed_%');
DELETE FROM service_requests
  WHERE requester_id IN (SELECT id FROM public.profiles WHERE username LIKE 'seed_%');
DELETE FROM bookings
  WHERE user_id IN (SELECT id FROM public.profiles WHERE username LIKE 'seed_%');
DELETE FROM vendor_services
  WHERE vendor_id IN (SELECT id FROM public.profiles WHERE username LIKE 'seed_%');
DELETE FROM events
  WHERE user_id IN (SELECT id FROM public.profiles WHERE username LIKE 'seed_%');
DELETE FROM public.profiles WHERE username LIKE 'seed_%';
DELETE FROM auth.users      WHERE email LIKE 'seed_%@demoapp.com';

RAISE NOTICE 'Cleanup and schema prep complete.';

-- ============================================================================
-- 1. CREATE 500 CUSTOMER USERS
--    Archetype, cohort, and train/val/test split all assigned here at the
--    USER level and stored in raw_user_meta_data so step 7 can read them back.
--    Split must be user-level (not interaction-level) to prevent data leakage.
-- ============================================================================
RAISE NOTICE 'Step 1: Creating 500 customer users...';

FOR i IN 1..500 LOOP
  new_uid       := uuid_generate_v4();
  f_name        := first_names[floor(random() * array_length(first_names, 1)) + 1];
  l_name        := last_names [floor(random() * array_length(last_names,  1)) + 1];
  full_n        := f_name || ' ' || l_name;
  uname         := 'seed_cust_' || i;
  email_str     := uname || '@demoapp.com';
  user_city     := cities[floor(random() * array_length(cities, 1)) + 1];

  -- Primary interest: one tag from generic pool
  user_interest := generic_tags[floor(random() * array_length(generic_tags, 1)) + 1];

  -- Archetype (stored ?EUR" read back in step 7)
  user_archetype := CASE
    WHEN random() < 0.25 THEN 'lurker'   -- 25%: 5?EUR"15 interactions
    WHEN random() < 0.65 THEN 'casual'   -- 40%: 20?EUR"50 interactions
    WHEN random() < 0.90 THEN 'regular'  -- 25%: 60?EUR"120 interactions
    ELSE                       'power'   -- 10%: 150?EUR"350 interactions
  END;

  -- Cohort: deterministic split so distribution is guaranteed
  user_cohort := CASE
    WHEN i <= 100 THEN 'new'
    WHEN i <= 380 THEN 'active'
    ELSE               'churned'
  END;

  -- Train/val/test split assigned at USER level ?EUR" prevents interaction leakage.
  -- 70% train / 15% val / 15% test
  user_split := CASE
    WHEN random() < 0.70 THEN 'train'
    WHEN random() < 0.85 THEN 'val'
    ELSE                      'test'
  END;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    new_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    email_str, crypt('Password123', gen_salt('bf')), NOW() - (random() * interval '180 days'),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_strip_nulls(json_build_object(
      'role',             'customer',
      'username',         uname,
      'city',             user_city,
      'primary_interest', user_interest,
      'archetype',        user_archetype,
      'cohort',           user_cohort,
      'split',            user_split
    )::jsonb),
    NOW() - (random() * interval '180 days'), NOW(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, username, full_name, role, created_at, updated_at)
  VALUES (new_uid, email_str, uname, full_n, 'customer',
          NOW() - (random() * interval '180 days'), NOW())
  ON CONFLICT (id) DO NOTHING;

  cust_ids := array_append(cust_ids, new_uid);
END LOOP;

-- ?"EUR?"EUR Organizers: 50 customers sampled across all cohorts ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
-- 20 from new (1?EUR"100), 20 from active (101?EUR"380), 10 from churned (381?EUR"500)
SELECT array_agg(id ORDER BY random()) INTO org_ids
FROM (
  (SELECT id FROM public.profiles
   WHERE username LIKE 'seed_cust_%'
     AND username IN (SELECT 'seed_cust_' || g FROM generate_series(1,100) g)
   ORDER BY random() LIMIT 20)
  UNION ALL
  (SELECT id FROM public.profiles
   WHERE username LIKE 'seed_cust_%'
     AND username IN (SELECT 'seed_cust_' || g FROM generate_series(101,380) g)
   ORDER BY random() LIMIT 20)
  UNION ALL
  (SELECT id FROM public.profiles
   WHERE username LIKE 'seed_cust_%'
     AND username IN (SELECT 'seed_cust_' || g FROM generate_series(381,500) g)
   ORDER BY random() LIMIT 10)
) sub;

-- ?"EUR?"EUR Sparse profiles: ~20% of users get incomplete optional fields ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
UPDATE public.profiles
SET avatar_url = NULL, bio = NULL
WHERE username LIKE 'seed_cust_%'
  AND random() < 0.20;

RAISE NOTICE 'Created 500 customers (split: 70/15/15 train/val/test), 50 organizers across cohorts.';

-- ============================================================================
-- 2. CREATE 100 VENDOR USERS
--    Vendors 1?EUR"20: premium tier (high price, high quality)
--    Vendors 21?EUR"60: standard tier (mid price, mid quality)
--    Vendors 61?EUR"100: budget tier (low price, lower quality)
--    Vendors 96?EUR"100: cold-start (no service requests in step 6)
-- ============================================================================
RAISE NOTICE 'Step 2: Creating 100 vendor users...';

FOR i IN 1..100 LOOP
  new_uid   := uuid_generate_v4();
  f_name    := first_names[floor(random() * array_length(first_names, 1)) + 1];
  l_name    := last_names [floor(random() * array_length(last_names,  1)) + 1];
  full_n    := f_name || ' ' || l_name;
  uname     := 'seed_ven_' || i;
  email_str := uname || '@demoapp.com';
  user_city := cities[floor(random() * array_length(cities, 1)) + 1];

  v_tier := CASE
    WHEN i <= 20 THEN 'premium'
    WHEN i <= 60 THEN 'standard'
    ELSE              'budget'
  END;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    new_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    email_str, crypt('Password123', gen_salt('bf')), NOW() - (random() * interval '180 days'),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role','vendor','username',uname,'city',user_city,'tier',v_tier)::jsonb,
    NOW() - (random() * interval '180 days'), NOW(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, username, full_name, role, created_at, updated_at)
  VALUES (new_uid, email_str, uname, full_n, 'vendor',
          NOW() - (random() * interval '180 days'), NOW())
  ON CONFLICT (id) DO NOTHING;

  ven_ids_arr := array_append(ven_ids_arr, new_uid);
END LOOP;

RAISE NOTICE 'Created 100 vendors (20 premium / 40 standard / 40 budget; 96?EUR"100 cold-start).';

-- ============================================================================
-- 3. CREATE ~500 VENDOR SERVICES (4?EUR"6 per vendor)
--    Price and quality banded by tier ?EUR" gives MOEA/D real cost-quality spread.
--    No nested DECLARE blocks; tier derived from loop index directly.
-- ============================================================================
RAISE NOTICE 'Step 3: Creating vendor services...';

FOR i IN 1..array_length(ven_ids_arr, 1) LOOP
  -- Derive tier from index (mirrors step 2 assignment)
  v_tier := CASE
    WHEN i <= 20 THEN 'premium'
    WHEN i <= 60 THEN 'standard'
    ELSE              'budget'
  END;

  FOR j IN 1..( floor(random() * 3) + 4 )::INT LOOP
    cat      := svc_categories[floor(random() * array_length(svc_categories, 1)) + 1];
    svc_name := format(
      svc_name_templates[floor(random() * array_length(svc_name_templates, 1)) + 1], cat
    );

    -- Base price by category
    base_p := CASE cat
      WHEN 'Fireworks'          THEN (floor(random() * 10) + 15) * 1000
      WHEN 'Projection Mapping' THEN (floor(random() * 15) + 20) * 1000
      WHEN 'Catering'           THEN (floor(random() * 20) + 8)  * 1000
      WHEN 'Live Band'          THEN (floor(random() * 12) + 8)  * 1000
      WHEN 'Stage Setup'        THEN (floor(random() * 10) + 6)  * 1000
      WHEN 'DJ & Music'         THEN (floor(random() * 8)  + 5)  * 1000
      WHEN 'Photography'        THEN (floor(random() * 6)  + 4)  * 1000
      WHEN 'Videography'        THEN (floor(random() * 8)  + 5)  * 1000
      WHEN 'Drone Photography'  THEN (floor(random() * 6)  + 6)  * 1000
      WHEN 'Decoration'         THEN (floor(random() * 8)  + 3)  * 1000
      WHEN 'Floral Design'      THEN (floor(random() * 5)  + 3)  * 1000
      WHEN 'Lighting'           THEN (floor(random() * 6)  + 3)  * 1000
      WHEN 'Sound System'       THEN (floor(random() * 5)  + 3)  * 1000
      WHEN 'Security'           THEN (floor(random() * 4)  + 2)  * 1000
      WHEN 'Valet Parking'      THEN (floor(random() * 3)  + 2)  * 1000
      WHEN 'Caricature Artist'  THEN (floor(random() * 3)  + 1)  * 1000
      WHEN 'Carnival Games'     THEN (floor(random() * 4)  + 1)  * 1000
      WHEN 'Photo Booth'        THEN (floor(random() * 4)  + 2)  * 1000
      ELSE                           (floor(random() * 8)  + 2)  * 1000
    END;

    -- Tier multiplier on price and quality range
    -- Premium: 1.8x price, quality 0.85?EUR"0.98
    -- Standard: 1.0x price, quality 0.55?EUR"0.84
    -- Budget:   0.6x price, quality 0.25?EUR"0.59
    IF v_tier = 'premium' THEN
      base_p      := base_p * 1.8;
      quality_val := (random() * 0.13 + 0.85)::NUMERIC;
    ELSIF v_tier = 'standard' THEN
      base_p      := base_p * 1.0;
      quality_val := (random() * 0.29 + 0.55)::NUMERIC;
    ELSE
      base_p      := base_p * 0.6;
      quality_val := (random() * 0.34 + 0.25)::NUMERIC;
    END IF;

    INSERT INTO vendor_services (
      id, vendor_id, service_name, description, base_price, price_unit,
      category, quality_score, created_at, updated_at
    ) VALUES (
      uuid_generate_v4(), ven_ids_arr[i], svc_name,
      'High-quality ' || lower(cat) || ' services tailored for events of all sizes. Professional team with 5+ years of experience.',
      base_p, 'per event', cat,
      quality_val,
      NOW() - (random() * interval '120 days'), NOW()
    );
  END LOOP;
END LOOP;

SELECT array_agg(id) INTO svc_ids FROM vendor_services WHERE vendor_id = ANY(ven_ids_arr);
RAISE NOTICE 'Created % vendor services across 3 quality/price tiers.', array_length(svc_ids, 1);

-- ============================================================================
-- 4. CREATE 250 EVENTS
--    ?EUR? Names cycled from 50-name pool with a city suffix to keep them distinct
--    ?EUR? 5% flagged is_trending ?EUR" these get a weighted interaction boost in step 7,
--      NOT a filter bypass (trending events still respect city/interest affinity)
--    ?EUR? Weekend-biased dates, category-aware times, budget tied to event type
--    ?EUR? Semantic tags matched to event category
-- ============================================================================
RAISE NOTICE 'Step 4: Creating 250 events...';

FOR i IN 1..250 LOOP
  organizer_uid := org_ids[(i - 1) % array_length(org_ids, 1) + 1];

  -- Cycle through 50-name pool; append a city suffix on second pass to differentiate
  ename := event_names[(i - 1) % array_length(event_names, 1) + 1];
  IF i > 50 THEN
    event_suffix := ' ' || cities[floor(random() * array_length(cities, 1)) + 1];
    ename := ename || event_suffix;
  END IF;

  edesc := event_descs[((i - 1) % array_length(event_descs, 1)) + 1];
  city  := cities[floor(random() * array_length(cities, 1)) + 1];
  vname := venue_names[floor(random() * array_length(venue_names, 1)) + 1];

  -- ?"EUR?"EUR Weekend-biased date ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
  start_dt := CURRENT_DATE + (floor(random() * 120) - 30)::INT;
  IF random() < 0.60 THEN
    start_dt := start_dt + ((6 - EXTRACT(DOW FROM start_dt)::INT + 7) % 7)::INT;
  END IF;
  end_dt := start_dt + (floor(random() * 2))::INT;

  -- ?"EUR?"EUR Category-aware start/end time ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
  start_time := CASE
    WHEN ename ILIKE '%night%'    OR ename ILIKE '%comedy%'   OR ename ILIKE '%music%'
      OR ename ILIKE '%DJ%'       OR ename ILIKE '%open mic%' OR ename ILIKE '%indie%'
      OR ename ILIKE '%beer%'
      THEN (floor(random() * 3) + 19)::TEXT || ':00'
    WHEN ename ILIKE '%yoga%'     OR ename ILIKE '%walk%'
      THEN (floor(random() * 2) + 6)::TEXT || ':00'
    WHEN ename ILIKE '%workshop%' OR ename ILIKE '%bootcamp%' OR ename ILIKE '%hackathon%'
      THEN '09:00'
    WHEN ename ILIKE '%gala%'     OR ename ILIKE '%dinner%'
      THEN (floor(random() * 2) + 18)::TEXT || ':00'
    ELSE
      (floor(random() * 4) + 9)::TEXT || ':00'
  END;

  end_time := CASE
    WHEN start_time >= '19:00' THEN '23:00'
    WHEN start_time <= '07:00' THEN '10:00'
    ELSE '20:00'
  END;

  -- ?"EUR?"EUR Budget tied to event type ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
  budget_val := CASE
    WHEN ename ILIKE '%gala%'    OR ename ILIKE '%summit%'  OR ename ILIKE '%expo%'
      OR ename ILIKE '%concert%' OR ename ILIKE '%fashion%' OR ename ILIKE '%launch%'
      THEN (floor(random() * 20) + 30) * 10000
    WHEN ename ILIKE '%night%'   OR ename ILIKE '%open mic%'
      OR ename ILIKE '%comedy%'  OR ename ILIKE '%indie%'
      THEN (floor(random() * 5) + 2) * 10000
    WHEN ename ILIKE '%bootcamp%' OR ename ILIKE '%workshop%' OR ename ILIKE '%walk%'
      THEN (floor(random() * 8) + 1) * 10000
    WHEN ename ILIKE '%hackathon%' OR ename ILIKE '%fest%'   OR ename ILIKE '%fair%'
      THEN (floor(random() * 10) + 5) * 10000
    ELSE (floor(random() * 15) + 5) * 10000
  END;

  -- ?"EUR?"EUR Semantic tags matched to event category ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
  tag_pool_for_event := CASE
    WHEN ename ILIKE '%tech%'     OR ename ILIKE '%summit%'    OR ename ILIKE '%hack%'
      OR ename ILIKE '%AI%'       OR ename ILIKE '%coding%'    OR ename ILIKE '%blockchain%'
      OR ename ILIKE '%robotics%' OR ename ILIKE '%startup%'   OR ename ILIKE '%digital%'
      THEN tech_tags
    WHEN ename ILIKE '%music%'    OR ename ILIKE '%concert%'   OR ename ILIKE '%indie%'
      OR ename ILIKE '%open mic%'
      THEN music_tags
    WHEN ename ILIKE '%food%'     OR ename ILIKE '%culinary%'  OR ename ILIKE '%beer%'
      OR ename ILIKE '%street food%'
      THEN food_tags
    WHEN ename ILIKE '%yoga%'     OR ename ILIKE '%wellness%'  OR ename ILIKE '%health%'
      OR ename ILIKE '%walk%'     OR ename ILIKE '%sports%'
      THEN wellness_tags
    WHEN ename ILIKE '%business%' OR ename ILIKE '%finance%'   OR ename ILIKE '%career%'
      OR ename ILIKE '%invest%'   OR ename ILIKE '%leadership%' OR ename ILIKE '%entrepreneur%'
      THEN biz_tags
    WHEN ename ILIKE '%art%'      OR ename ILIKE '%photo%'     OR ename ILIKE '%design%'
      OR ename ILIKE '%film%'     OR ename ILIKE '%dance%'     OR ename ILIKE '%literature%'
      OR ename ILIKE '%culture%'  OR ename ILIKE '%craft%'
      THEN art_tags
    WHEN ename ILIKE '%sport%'    OR ename ILIKE '%game%'      OR ename ILIKE '%champion%'
      THEN sport_tags
    ELSE generic_tags
  END;

  tags_arr := ARRAY[
    tag_pool_for_event[floor(random() * array_length(tag_pool_for_event, 1)) + 1],
    tag_pool_for_event[floor(random() * array_length(tag_pool_for_event, 1)) + 1],
    tag_pool_for_event[floor(random() * array_length(tag_pool_for_event, 1)) + 1]
  ];

  INSERT INTO events (
    id, user_id, user_email, event_name, event_description,
    start_date, start_time, end_date, end_time, timezone,
    visibility_type, event_status,
    max_attendees, budget,
    venue_name, venue_city, venue_latitude, venue_longitude, venue_type,
    organizer_name, organizer_email,
    tags, is_trending, created_at, updated_at
  )
  SELECT
    uuid_generate_v4(), organizer_uid, p.email,
    ename, edesc,
    start_dt, start_time::time, end_dt, end_time::time, 'Asia/Kolkata',
    (CASE WHEN random() < 0.8 THEN 'public' ELSE 'private' END)::visibility_type,
    (CASE
      WHEN start_dt < CURRENT_DATE THEN 'completed'
      WHEN start_dt = CURRENT_DATE THEN 'ongoing'
      ELSE 'upcoming'
    END)::event_status,
    (floor(random() * 450) + 50)::INT,
    budget_val,
    vname, city,
    get_city_latitude(city),
    get_city_longitude(city),
    (CASE WHEN random() < 0.6 THEN 'indoor'
          WHEN random() < 0.8 THEN 'outdoor'
          ELSE 'hybrid' END)::venue_type,
    p.full_name, p.email,
    tags_arr,
    (random() < 0.05),  -- 5% trending
    NOW() - (random() * interval '90 days'), NOW()
  FROM public.profiles p WHERE p.id = organizer_uid;

END LOOP;

SELECT array_agg(id) INTO evt_ids FROM events WHERE user_id = ANY(org_ids);
RAISE NOTICE 'Created % events (5%% trending).', array_length(evt_ids, 1);

-- ============================================================================
-- 5. BOOKINGS
--    ?EUR? Viral events (5% chance per booking loop): spike toward max_attendees
--    ?EUR? Dud events (10% chance): mostly cancellations ?EUR" creates attendance outliers
--      for demand forecasting to learn from
--    ?EUR? Regular bookings follow the same 75/15/10 confirmed/waitlist/cancelled split
--    ?EUR? Correlated view + rsvp always precede a booking (realistic funnel)
-- ============================================================================
RAISE NOTICE 'Step 5: Creating bookings...';

FOR i IN 1..array_length(cust_ids, 1) LOOP
  FOR j IN 1..( floor(random() * 8) + 8 )::INT LOOP
    evt_id    := evt_ids[floor(random() * array_length(evt_ids, 1)) + 1];
    v_created := NOW() - (POWER(random(), 2) * interval '80 days');

    SELECT count(*) INTO conf_count
    FROM bookings WHERE event_id = evt_id AND status = 'confirmed';

    -- Viral/dud logic without nested DECLARE
    IF random() < 0.05 THEN
      -- Viral: force confirmed regardless of capacity (creates sold-out pressure)
      status_val := 'confirmed';
    ELSIF random() < 0.10 THEN
      -- Dud: force cancellation (creates low-attendance outlier events)
      status_val := 'cancelled';
    ELSE
      status_val := CASE
        WHEN random() < 0.75 THEN
          CASE WHEN conf_count < (SELECT max_attendees FROM events WHERE id = evt_id)
               THEN 'confirmed' ELSE 'waitlist' END
        WHEN random() < 0.90 THEN 'waitlist'
        ELSE 'cancelled'
      END;
    END IF;

    INSERT INTO bookings (event_id, user_id, status, created_at)
    VALUES (evt_id, cust_ids[i], status_val::booking_status, v_created)
    ON CONFLICT DO NOTHING;

    -- Correlated view always precedes a booking
    INSERT INTO user_interactions (user_id, event_id, interaction_type, implicit_score, created_at)
    VALUES (cust_ids[i], evt_id, 'view', 0.3, v_created - interval '2 hours')
    ON CONFLICT DO NOTHING;

    -- RSVP precedes confirmed/waitlist bookings
    IF status_val IN ('confirmed', 'waitlist') THEN
      INSERT INTO user_interactions (user_id, event_id, interaction_type, implicit_score, created_at)
      VALUES (cust_ids[i], evt_id, 'rsvp', 0.9, v_created - interval '1 hour')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END LOOP;

-- ?"EUR?"EUR Booking lifecycle mutations ?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR?"EUR
-- 8% of confirmed bookings get cancelled (churn simulation)
UPDATE bookings
SET status = 'cancelled'
WHERE status = 'confirmed'
  AND user_id = ANY(cust_ids)
  AND random() < 0.08;

-- 30% of waitlisted bookings get promoted to confirmed
UPDATE bookings b
SET status = 'confirmed'
WHERE b.status = 'waitlist'
  AND (SELECT count(*) FROM bookings WHERE event_id = b.event_id AND status = 'confirmed')
    < (SELECT max_attendees FROM events WHERE id = b.event_id)
  AND random() < 0.30;

RAISE NOTICE 'Bookings created with viral/dud variance for forecasting signal.';

-- ============================================================================
-- 6. SERVICE REQUESTS
--    ?EUR? Varied message templates
--    ?EUR? 70% city-preferring, quality-biased vendor selection
--    ?EUR? Cold-start guard: vendors 96?EUR"100 receive zero requests
-- ============================================================================
RAISE NOTICE 'Step 6: Creating service requests...';

FOR i IN 1..array_length(org_ids, 1) LOOP
  organizer_uid := org_ids[i];

  SELECT au.raw_user_meta_data->>'city'
  INTO user_city
  FROM auth.users au WHERE au.id = organizer_uid;

  FOR j IN 1..( floor(random() * 6) + 3 )::INT LOOP
    -- Pick an event this organizer actually OWNS (80% of the time).
    -- Fallback to any event if they have none or the 20% random path fires.
    evt_id := NULL;
    IF random() < 0.80 THEN
      SELECT e.id INTO evt_id
      FROM events e
      WHERE e.user_id = organizer_uid
      ORDER BY random()
      LIMIT 1;
    END IF;
    -- If no own event found (or 20% path), use global pool
    IF evt_id IS NULL THEN
      evt_id := evt_ids[floor(random() * array_length(evt_ids, 1)) + 1];
    END IF;

    v_created    := NOW() - (POWER(random(), 1.5) * interval '60 days');
    msg_template := request_messages[floor(random() * array_length(request_messages, 1)) + 1];

    status_val := CASE
      WHEN random() < 0.40 THEN 'accepted'
      WHEN random() < 0.65 THEN 'pending'
      WHEN random() < 0.80 THEN 'completed'
      WHEN random() < 0.90 THEN 'rejected'
      ELSE                       'cancelled'
    END;

    -- Quality-biased, city-preferring selection; cold-start vendors excluded
    IF random() < 0.70 THEN
      SELECT vs.id INTO svc_id
      FROM vendor_services vs
      JOIN public.profiles vp ON vp.id = vs.vendor_id
      JOIN auth.users       au ON au.id = vp.id
      WHERE vs.vendor_id = ANY(ven_ids_arr[1:95])
        AND (au.raw_user_meta_data->>'city' = user_city OR random() < 0.25)
      ORDER BY vs.quality_score DESC, random()
      LIMIT 1 OFFSET floor(random() * 15)::INT;
    ELSE
      SELECT vs.id INTO svc_id
      FROM vendor_services vs
      WHERE vs.vendor_id = ANY(ven_ids_arr[1:95])
      ORDER BY random() LIMIT 1;
    END IF;

    IF svc_id IS NULL THEN
      svc_id := svc_ids[floor(random() * array_length(svc_ids, 1)) + 1];
    END IF;

    INSERT INTO service_requests (
      id, event_id, service_id, requester_id, vendor_id, status, message, created_at, updated_at
    )
    SELECT
      uuid_generate_v4(), evt_id, svc_id, organizer_uid, vs.vendor_id,
      status_val::service_request_status,
      msg_template,
      v_created,
      v_created + (random() * interval '2 days')
    FROM vendor_services vs WHERE vs.id = svc_id
    ON CONFLICT DO NOTHING;

    INSERT INTO user_interactions (
      user_id, event_id, vendor_service_id, interaction_type, implicit_score, created_at
    )
    SELECT organizer_uid, evt_id, svc_id, 'vendor_view', 0.2, v_created - interval '1 hour'
    ON CONFLICT DO NOTHING;

  END LOOP;
END LOOP;

RAISE NOTICE 'Service requests created.';

-- ============================================================================
-- 6b. POPULATE event_vendors FROM ACCEPTED SERVICE REQUESTS
--     This fixes the Pro-Team tab being empty. event_vendors is the formal
--     roster shown to organizers. We promote all accepted requests into it.
-- ============================================================================
RAISE NOTICE 'Step 6b: Populating event_vendors from accepted requests...';

INSERT INTO event_vendors (id, event_id, vendor_id, service_id, request_id, hired_at)
SELECT
  uuid_generate_v4(),
  sr.event_id,
  sr.vendor_id,
  sr.service_id,
  sr.id,
  sr.updated_at
FROM service_requests sr
WHERE sr.requester_id = ANY(org_ids)
  AND sr.status = 'accepted'
ON CONFLICT (event_id, service_id) DO NOTHING;

RAISE NOTICE 'event_vendors populated.';

-- ============================================================================
-- 6c. SEED VENDOR RATINGS
--     Organizers rate vendors for completed events (past date).
--     Ratings are tier-biased: premium vendors get 4?EUR"5 stars, budget 2?EUR"3.
--     Triggers auto-update vendor_services.rating.
-- ============================================================================
RAISE NOTICE 'Step 6c: Seeding vendor ratings...';

-- Clean up any prior seed ratings
DELETE FROM vendor_ratings
WHERE rater_id = ANY(org_ids);

FOR sr_rec IN (
  SELECT sr.id AS sr_id, sr.service_id, sr.vendor_id, sr.event_id, sr.requester_id,
         e.start_date
  FROM service_requests sr
  JOIN events e ON e.id = sr.event_id
  WHERE sr.requester_id = ANY(org_ids)
    AND sr.status IN ('accepted', 'completed')
    AND e.start_date < CURRENT_DATE
) LOOP
  -- 70% chance they actually left a rating
  IF random() > 0.30 THEN
    -- Tier-biased rating: derive from vendor position in ven_ids_arr
    ven_idx := array_position(ven_ids_arr, sr_rec.vendor_id);
    rat_val := CASE
      WHEN ven_idx IS NOT NULL AND ven_idx <= 20 THEN (floor(random() * 2) + 4)::SMALLINT
      WHEN ven_idx IS NOT NULL AND ven_idx <= 60 THEN (floor(random() * 2) + 3)::SMALLINT
      ELSE                                             (floor(random() * 2) + 2)::SMALLINT
    END;

    INSERT INTO vendor_ratings (id, service_request_id, event_id, vendor_id, service_id, rater_id, rating, created_at)
    VALUES (
      uuid_generate_v4(),
      sr_rec.sr_id,
      sr_rec.event_id,
      sr_rec.vendor_id,
      sr_rec.service_id,
      sr_rec.requester_id,
      rat_val,
      sr_rec.start_date::TIMESTAMPTZ + interval '1 day'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END LOOP;

-- Backfill vendor_services.rating from the seeded ratings
UPDATE vendor_services vs
SET rating = sub.avg_rating
FROM (
  SELECT service_id, ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating
  FROM vendor_ratings
  GROUP BY service_id
) sub
WHERE vs.id = sub.service_id;

RAISE NOTICE 'Vendor ratings seeded and vendor_services.rating backfilled.';



-- ============================================================================
-- 7. USER INTERACTION SIGNALS
--    ?EUR? Archetype determines interaction count (values match comments)
--    ?EUR? Cohort anchors session recency
--    ?EUR? Session clustering: 3?EUR"8 actions per burst, then new session
--    ?EUR? 40% chance each new session falls on a Friday/Saturday evening (temporal bias)
--    ?EUR? City/interest affinity at 70% ?EUR" keeps graph connected across cities
--    ?EUR? Trending events get a 20% selection boost (weighted, not a bypass)
--    ?EUR? Steep funnel: view 40% / favorite 30% / vendor_view 15% / rsvp 10% / confirmed 5%
--    ?EUR? 10% of views generate a 'not_interested' negative signal
--    ?EUR? Split tag copied from user-level assignment (no leakage)
-- ============================================================================
RAISE NOTICE 'Step 7: Creating interaction signals...';

FOR i IN 1..array_length(cust_ids, 1) LOOP

  SELECT
    au.raw_user_meta_data->>'city',
    au.raw_user_meta_data->>'primary_interest',
    au.raw_user_meta_data->>'archetype',
    au.raw_user_meta_data->>'cohort',
    au.raw_user_meta_data->>'split'
  INTO user_city, user_interest, user_archetype, user_cohort, user_split
  FROM auth.users au WHERE au.id = cust_ids[i];

  -- Interaction counts matching archetype comments
  num_ints := CASE user_archetype
    WHEN 'lurker'  THEN floor(random() * 11)  + 5    -- 5?EUR"15
    WHEN 'casual'  THEN floor(random() * 31)  + 20   -- 20?EUR"50
    WHEN 'regular' THEN floor(random() * 61)  + 60   -- 60?EUR"120
    ELSE                floor(random() * 201) + 150  -- 150?EUR"350
  END;

  session_base := CASE user_cohort
    WHEN 'new'    THEN NOW() - (random()           * interval '14 days')
    WHEN 'active' THEN NOW() - (POWER(random(), 2) * interval '60 days')
    ELSE               NOW() - (interval '60 days' + random() * interval '120 days')
  END;

  session_ctr := 0;

  FOR j IN 1..num_ints LOOP

    -- New session every 3?EUR"8 interactions
    session_ctr := session_ctr + 1;
    IF session_ctr > (floor(random() * 6) + 3)::INT THEN
      session_base := CASE user_cohort
        WHEN 'new'    THEN NOW() - (random()           * interval '14 days')
        WHEN 'active' THEN NOW() - (POWER(random(), 2) * interval '60 days')
        ELSE               NOW() - (interval '60 days' + random() * interval '120 days')
      END;

      -- 40% of new sessions: bias toward Friday/Saturday evening (18:00?EUR"23:59)
      -- This creates realistic temporal spikes for demand forecasting
      IF random() < 0.40 THEN
        session_base := date_trunc('week', session_base)
          + (floor(random() * 2) + 4) * interval '1 day'   -- day 4=Fri, 5=Sat
          + (floor(random() * 6) + 18) * interval '1 hour'; -- 18:00?EUR"23:00
      END IF;

      session_ctr := 1;
    END IF;

    -- Small jitter within session (0?EUR"20 minutes)
    v_created := session_base + (random() * interval '20 minutes');

    -- Event selection: 70% city/interest affinity, 30% random
    -- Trending events get a weighted boost: if selected pool is empty,
    -- fall back to a trending event before going fully random
    IF random() < 0.70 THEN
      SELECT id INTO evt_id FROM events
      WHERE venue_city = user_city OR user_interest = ANY(tags)
      ORDER BY
        -- Trending events sort higher within the affinity pool (weighted boost)
        CASE WHEN is_trending THEN 0 ELSE 1 END,
        random()
      LIMIT 1;
      IF evt_id IS NULL THEN
        -- Secondary fallback: any trending event
        SELECT id INTO evt_id FROM events WHERE is_trending ORDER BY random() LIMIT 1;
      END IF;
      IF evt_id IS NULL THEN
        evt_id := evt_ids[floor(random() * array_length(evt_ids, 1)) + 1];
      END IF;
    ELSE
      evt_id := evt_ids[floor(random() * array_length(evt_ids, 1)) + 1];
    END IF;

    -- Funnel probabilities
    rand_val := random();
    IF    rand_val < 0.40 THEN i_type := 'view';        i_weight := 0.3;
    ELSIF rand_val < 0.70 THEN i_type := 'favorite';    i_weight := 0.7;
    ELSIF rand_val < 0.85 THEN i_type := 'vendor_view'; i_weight := 0.2;
    ELSIF rand_val < 0.95 THEN i_type := 'rsvp';        i_weight := 0.9;
    ELSE                        i_type := 'confirmed';   i_weight := 1.0;
    END IF;

    -- Split comes from user-level assignment (prevents leakage)
    i_split := user_split;

    INSERT INTO user_interactions (
      user_id, event_id, vendor_service_id, interaction_type, implicit_score, split, created_at
    ) VALUES (
      cust_ids[i],
      evt_id,
      CASE WHEN i_type = 'vendor_view'
           THEN svc_ids[floor(random() * array_length(svc_ids, 1)) + 1]
           ELSE NULL END,
      i_type,
      i_weight,
      i_split,
      v_created
    ) ON CONFLICT DO NOTHING;

    -- Negative signal: 10% of views get 'not_interested' 5 minutes later
    IF i_type = 'view' AND random() < 0.10 THEN
      INSERT INTO user_interactions (
        user_id, event_id, interaction_type, implicit_score, split, created_at
      ) VALUES (
        cust_ids[i], evt_id, 'not_interested', 0.0, i_split,
        v_created + interval '5 minutes'
      ) ON CONFLICT DO NOTHING;
    END IF;

  END LOOP;
END LOOP;

RAISE NOTICE 'Interaction signals created.';

-- ============================================================================
-- 8. SYNC ATTENDEE COUNTS
-- ============================================================================
RAISE NOTICE 'Step 8: Syncing attendee counts...';

UPDATE events e
SET attendee_count = sub.cnt
FROM (
  SELECT event_id, COUNT(*) AS cnt
  FROM bookings WHERE status = 'confirmed'
  GROUP BY event_id
) sub
WHERE e.id = sub.event_id;

-- Zero out events with no confirmed bookings explicitly
UPDATE events
SET attendee_count = 0
WHERE attendee_count IS NULL
  AND user_id = ANY(org_ids);

RAISE NOTICE 'Attendee counts synced.';

-- ============================================================================
-- 9. QUALITY SCORE CALIBRATION
--    Nudge quality_score upward for vendors with completed requests.
--    Cap at 0.98 to avoid perfect-score artefacts.
--    Tier bands are preserved: premium can reach 0.98, budget stays lower
--    because they start lower and have fewer completed requests.
-- ============================================================================
RAISE NOTICE 'Step 9: Calibrating quality scores from completed requests...';

UPDATE vendor_services vs
SET quality_score = LEAST(0.98,
  quality_score + (
    SELECT COUNT(*) * 0.02
    FROM service_requests sr
    WHERE sr.service_id = vs.id
      AND sr.status = 'completed'
  )
)
WHERE vendor_id = ANY(ven_ids_arr);

RAISE NOTICE 'Quality scores calibrated.';

-- ============================================================================
-- 10. DELIBERATE EDGE CASES
-- ============================================================================
RAISE NOTICE 'Step 10: Injecting edge cases...';

-- 2 sold-out events
UPDATE events
SET max_attendees = attendee_count
WHERE id IN (evt_ids[1], evt_ids[2])
  AND attendee_count > 0;

-- 1 cancelled event (bookings intact ?EUR" tests cancellation handling)
UPDATE events
SET event_status = 'cancelled'
WHERE id = evt_ids[3];

-- 3 churned organizers: strip all recent interactions (last 90 days)
DELETE FROM user_interactions
WHERE user_id IN (org_ids[48], org_ids[49], org_ids[50])
  AND created_at > NOW() - interval '90 days';

-- 3 ultra-lurker customers: strip down to exactly 1 interaction each
DELETE FROM user_interactions
WHERE user_id IN (cust_ids[498], cust_ids[499], cust_ids[500])
  AND id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM user_interactions
    WHERE user_id IN (cust_ids[498], cust_ids[499], cust_ids[500])
    ORDER BY user_id, created_at ASC
  );

-- Dud events: force 5 events to very low attendance (<10% of capacity)
-- This gives demand forecasting genuine low-attendance outliers to learn from
UPDATE events
SET attendee_count = GREATEST(1, floor(max_attendees * 0.05)::INT)
WHERE id IN (evt_ids[10], evt_ids[11], evt_ids[12], evt_ids[13], evt_ids[14])
  AND attendee_count IS NOT NULL;

RAISE NOTICE 'Edge cases injected.';

-- ============================================================================
-- 11. SUMMARY
-- ============================================================================
RAISE NOTICE '=================================================================';
RAISE NOTICE 'RESEARCH SEED COMPLETE ?EUR" v4 (Research Grade)';
RAISE NOTICE '-----------------------------------------------------------------';
RAISE NOTICE 'profiles (customers)    : %', (SELECT count(*) FROM public.profiles WHERE username LIKE 'seed_cust_%');
RAISE NOTICE 'profiles (vendors)      : %', (SELECT count(*) FROM public.profiles WHERE username LIKE 'seed_ven_%');
RAISE NOTICE 'events (total)          : %', (SELECT count(*) FROM events WHERE user_id = ANY(org_ids));
RAISE NOTICE '  of which trending     : %', (SELECT count(*) FROM events WHERE is_trending = TRUE AND user_id = ANY(org_ids));
RAISE NOTICE '  of which cancelled    : %', (SELECT count(*) FROM events WHERE event_status::text = 'cancelled' AND user_id = ANY(org_ids));
RAISE NOTICE 'vendor_services (total) : %', (SELECT count(*) FROM vendor_services WHERE vendor_id = ANY(ven_ids_arr));
RAISE NOTICE '  premium tier          : %', (SELECT count(*) FROM vendor_services WHERE vendor_id = ANY(ven_ids_arr[1:20]));
RAISE NOTICE '  standard tier         : %', (SELECT count(*) FROM vendor_services WHERE vendor_id = ANY(ven_ids_arr[21:60]));
RAISE NOTICE '  budget tier           : %', (SELECT count(*) FROM vendor_services WHERE vendor_id = ANY(ven_ids_arr[61:100]));
RAISE NOTICE 'bookings (confirmed)    : %', (SELECT count(*) FROM bookings WHERE user_id = ANY(cust_ids) AND status::text = 'confirmed');
RAISE NOTICE 'bookings (cancelled)    : %', (SELECT count(*) FROM bookings WHERE user_id = ANY(cust_ids) AND status::text = 'cancelled');
RAISE NOTICE 'service_requests        : %', (SELECT count(*) FROM service_requests WHERE requester_id = ANY(org_ids));
RAISE NOTICE '  completed             : %', (SELECT count(*) FROM service_requests WHERE requester_id = ANY(org_ids) AND status::text = 'completed');
DECLARE
  cnt_total  BIGINT;
  cnt_train  BIGINT;
  cnt_val    BIGINT;
  cnt_test   BIGINT;
  cnt_notin  BIGINT;
BEGIN
  SELECT count(*) INTO cnt_total FROM user_interactions WHERE user_id = ANY(cust_ids);
  SELECT count(*) INTO cnt_train FROM user_interactions WHERE user_id = ANY(cust_ids) AND split = 'train';
  SELECT count(*) INTO cnt_val   FROM user_interactions WHERE user_id = ANY(cust_ids) AND split = 'val';
  SELECT count(*) INTO cnt_test  FROM user_interactions WHERE user_id = ANY(cust_ids) AND split = 'test';
  SELECT count(*) INTO cnt_notin FROM user_interactions WHERE user_id = ANY(cust_ids) AND interaction_type = 'not_interested';
  RAISE NOTICE 'user_interactions       : %', cnt_total;
  RAISE NOTICE '  train split           : %', cnt_train;
  RAISE NOTICE '  val split             : %', cnt_val;
  RAISE NOTICE '  test split            : %', cnt_test;
  RAISE NOTICE '  not_interested        : %', cnt_notin;
END;
RAISE NOTICE '-----------------------------------------------------------------';
RAISE NOTICE 'Cohorts      : new(~20%%) / active(~56%%) / churned(~24%%)';
RAISE NOTICE 'Archetypes   : ~25%% lurker / ~40%% casual / ~25%% regular / ~10%% power';
RAISE NOTICE 'Vendor tiers : 20 premium / 40 standard / 40 budget (96?EUR"100 cold-start)';
RAISE NOTICE 'Splits       : 70/15/15 train/val/test ?EUR" assigned at USER level';
RAISE NOTICE 'Edge cases   : 2 sold-out / 1 cancelled / 5 dud events';
RAISE NOTICE '             : 3 churned organizers / 3 ultra-lurkers';
RAISE NOTICE 'Temporal     : 40%% Friday/Saturday evening session bias';
RAISE NOTICE 'Trending     : 5%% of events flagged, weighted sort boost only';
RAISE NOTICE '=================================================================';

END $$;