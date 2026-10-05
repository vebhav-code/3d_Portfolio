-- =========================================================================
-- SUPABASE SCHEMA SETUP FOR 3D PORTFOLIO
-- Project: geaziypuwsucehkrcjup
-- Direct Link: https://supabase.com/dashboard/project/geaziypuwsucehkrcjup/sql/new
-- =========================================================================

-- 1. Create Messages Table for the "Initiate Contact" Dispatcher Form
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.messages enable row level security;

-- 3. Policy: Allow any portfolio visitor to submit a contact message
create policy "Allow anonymous message submissions"
on public.messages
for insert
to anon, authenticated
with check (true);

-- 4. Policy: Allow you to read the incoming messages from the dashboard
create policy "Allow message viewing"
on public.messages
for select
to authenticated, anon
using (true);

-- 5. Policy: Allow message deletion (for Admin Console)
create policy "Allow message deletion"
on public.messages
for delete
to authenticated, anon
using (true);

-- 6. Index for fast sorting by date
create index if not exists messages_created_at_idx on public.messages (created_at desc);

-- =========================================================================
-- OPTIONAL: Visitor Page Analytics Table
-- =========================================================================
create table if not exists public.page_views (
  id uuid default gen_random_uuid() primary key,
  path text default '/',
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.page_views enable row level security;

create policy "Allow anonymous page view logging"
on public.page_views
for insert
to anon, authenticated
with check (true);

create policy "Allow page view viewing"
on public.page_views
for select
to authenticated, anon
using (true);
