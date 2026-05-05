-- ============================================================
-- TEST ACCOUNTS FOR LOCAL DEVELOPMENT
-- customer@test.com  / Test1234!
-- vendor@test.com    / Test1234!
-- admin@test.com     / Test1234!
--
-- UUIDs (v4 - must pass Zod z.string().uuid()):
--   customer : 00000000-0000-4000-a000-000000000001
--   vendor   : 00000000-0000-4000-a000-000000000002
--   admin    : 00000000-0000-4000-a000-000000000003
-- ============================================================

-- Clean up existing test accounts by email to ensure idempotency.
-- This prevents unique constraint errors on the 'email' column if the IDs were changed,
-- and ensures passwords and metadata are fully reset on each run.
DELETE FROM auth.users WHERE email IN ('customer@test.com', 'vendor@test.com', 'admin@test.com');
DELETE FROM public.profiles WHERE email IN ('customer@test.com', 'vendor@test.com', 'admin@test.com');

-- Insert auth users (password hash = bcrypt of 'Test1234!')
-- NOTE: token columns must be '' not NULL ?EUR" GoTrue returns 500 on NULL scan.
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current
) VALUES
  (
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'customer@test.com',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"role":"customer","full_name":"Test Customer"}'::jsonb,
    'authenticated', 'authenticated',
    '', '', '', '', ''
  ),
  (
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'vendor@test.com',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"role":"vendor","full_name":"Test Vendor"}'::jsonb,
    'authenticated', 'authenticated',
    '', '', '', '', ''
  ),
  (
    '00000000-0000-4000-a000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'admin@test.com',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"role":"admin","full_name":"Test Admin"}'::jsonb,
    'authenticated', 'authenticated',
    '', '', '', '', ''
  )
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- Insert identities (required for email/password login to work)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES
  (
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000001',
    'customer@test.com',
    'email',
    '{"sub":"00000000-0000-4000-a000-000000000001","email":"customer@test.com"}'::jsonb,
    now(), now(), now()
  ),
  (
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000002',
    'vendor@test.com',
    'email',
    '{"sub":"00000000-0000-4000-a000-000000000002","email":"vendor@test.com"}'::jsonb,
    now(), now(), now()
  ),
  (
    '00000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000003',
    'admin@test.com',
    'email',
    '{"sub":"00000000-0000-4000-a000-000000000003","email":"admin@test.com"}'::jsonb,
    now(), now(), now()
  )
ON CONFLICT (id) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = now();

-- Profiles are auto-created by trigger, but upsert just in case
INSERT INTO public.profiles (id, email, full_name, role, username, created_at, updated_at)
VALUES
  ('00000000-0000-4000-a000-000000000001', 'customer@test.com', 'Test Customer', 'customer', 'test_customer', now(), now()),
  ('00000000-0000-4000-a000-000000000002', 'vendor@test.com',   'Test Vendor',   'vendor',   'test_vendor',   now(), now()),
  ('00000000-0000-4000-a000-000000000003', 'admin@test.com',    'Test Admin',    'admin',    'test_admin',    now(), now())
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  updated_at = now();

DO $$
BEGIN
  RAISE NOTICE '🚀 Test accounts created or updated:';
  RAISE NOTICE '  customer@test.com / Test1234!  (00000000-0000-4000-a000-000000000001)';
  RAISE NOTICE '  vendor@test.com   / Test1234!  (00000000-0000-4000-a000-000000000002)';
  RAISE NOTICE '  admin@test.com    / Test1234!  (00000000-0000-4000-a000-000000000003)';
END $$;
