-- ============================================================
-- Storage buckets required by the app
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('events', 'events', true),
  ('event-banners', 'event-banners', true),
  ('avatars', 'avatars', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "Authenticated users can upload event banners" on storage.objects;
create policy "Authenticated users can upload event banners"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'event-banners');

drop policy if exists "Authenticated users can upload event media" on storage.objects;
create policy "Authenticated users can upload event media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'events');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "Public can read event banners" on storage.objects;
create policy "Public can read event banners"
  on storage.objects
  for select
  using (bucket_id = 'event-banners');

drop policy if exists "Public can read event media" on storage.objects;
create policy "Public can read event media"
  on storage.objects
  for select
  using (bucket_id = 'events');

drop policy if exists "Public can read avatars" on storage.objects;
create policy "Public can read avatars"
  on storage.objects
  for select
  using (bucket_id = 'avatars');