-- Create chat_history table for storing event chatbot conversations
create table if not exists public.chat_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index for faster lookups (user_id + event_id)
create index if not exists idx_chat_history_user_event 
  on public.chat_history(user_id, event_id);

-- Enable RLS (Row Level Security)
alter table public.chat_history enable row level security;

-- Users can only view their own chat history
create policy "Users can view their own chat history"
  on public.chat_history
  for select
  using (auth.uid() = user_id);

-- Users can only insert their own chat history
create policy "Users can insert their own chat history"
  on public.chat_history
  for insert
  with check (auth.uid() = user_id);

-- Users can only update their own chat history
create policy "Users can update their own chat history"
  on public.chat_history
  for update
  using (auth.uid() = user_id);

-- Users can only delete their own chat history
create policy "Users can delete their own chat history"
  on public.chat_history
  for delete
  using (auth.uid() = user_id);
