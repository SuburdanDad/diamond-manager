-- ═══════════════════════════════════════════════════════════════════════════
-- Diamond Manager — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════════

-- Events table
create table if not exists events (
  id text primary key,
  field_id text not null,
  date text not null,
  start_time text not null,
  duration integer not null default 120,
  division_id text default '',
  event_type text not null default 'game',
  title text default '',
  notes text default '',
  home_team text default '',
  away_team text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast week-view queries
create index if not exists idx_events_date on events (date);
create index if not exists idx_events_field_date on events (field_id, date);

-- Enable Row Level Security (RLS)
-- For a shared league board tool, we allow all authenticated or anonymous
-- access. Tighten this later if you add user auth.
alter table events enable row level security;

-- Policy: allow all operations for now (public board tool)
create policy "Allow all access" on events
  for all
  using (true)
  with check (true);

-- Auto-update the updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at
  before update on events
  for each row
  execute function update_updated_at();
