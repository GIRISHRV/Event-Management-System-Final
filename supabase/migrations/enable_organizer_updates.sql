-- Enable RLS on bookings if not already enabled
alter table bookings enable row level security;

-- Policy to allow event organizers to update bookings for their own events
create policy "Organizers can update bookings for their events"
on bookings for update
using (
  auth.uid() in (
    select user_id from events where id = bookings.event_id
  )
);

-- Policy to allow event organizers to view bookings for their own events (if not already present)
create policy "Organizers can view bookings for their events"
on bookings for select
using (
  auth.uid() in (
    select user_id from events where id = bookings.event_id
  )
);
