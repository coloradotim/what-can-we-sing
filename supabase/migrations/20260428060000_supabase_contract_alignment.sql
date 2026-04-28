create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_repertoire (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_title text not null,
  voicing text not null,
  arranger_name text,
  parts_known text[] not null,
  confidence text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  join_code text not null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz
);

create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  repertoire jsonb not null default '[]'::jsonb,
  joined_at timestamptz not null default now()
);

create table if not exists public.sung_song_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  song_title text not null,
  voicing text not null,
  arranger_name text,
  sung_at timestamptz not null default now()
);

alter table public.user_repertoire
  add column if not exists notes text;

alter table public.sessions
  add column if not exists last_activity_at timestamptz;

create unique index if not exists sessions_join_code_key
on public.sessions (join_code);

create unique index if not exists session_participants_session_user_key
on public.session_participants (session_id, user_id);

create index if not exists user_repertoire_user_title_idx
on public.user_repertoire (user_id, song_title);

create index if not exists session_participants_session_joined_idx
on public.session_participants (session_id, joined_at);

create index if not exists sung_song_events_user_sung_at_idx
on public.sung_song_events (user_id, sung_at desc);

alter table public.profiles enable row level security;
alter table public.user_repertoire enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.sung_song_events enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_repertoire to authenticated;
grant select, insert, update on public.sessions to authenticated;
grant select, insert, update, delete on public.session_participants to authenticated;
grant select, insert on public.sung_song_events to authenticated;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can read their own repertoire" on public.user_repertoire;
drop policy if exists "Users can insert their own repertoire" on public.user_repertoire;
drop policy if exists "Users can update their own repertoire" on public.user_repertoire;
drop policy if exists "Users can delete their own repertoire" on public.user_repertoire;
drop policy if exists "Authenticated users can read sessions" on public.sessions;
drop policy if exists "Authenticated users can create sessions" on public.sessions;
drop policy if exists "Authenticated users can update session activity" on public.sessions;
drop policy if exists "Authenticated users can read session participants" on public.session_participants;
drop policy if exists "Users can insert their own session participant row" on public.session_participants;
drop policy if exists "Users can update their own session participant row" on public.session_participants;
drop policy if exists "Users can delete their own session participant row" on public.session_participants;
drop policy if exists "Users can read their sung song events" on public.sung_song_events;
drop policy if exists "Users can insert their sung song events" on public.sung_song_events;

create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read their own repertoire"
on public.user_repertoire
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert their own repertoire"
on public.user_repertoire
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own repertoire"
on public.user_repertoire
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own repertoire"
on public.user_repertoire
for delete
to authenticated
using (user_id = auth.uid());

create policy "Authenticated users can read sessions"
on public.sessions
for select
to authenticated
using (true);

create policy "Authenticated users can create sessions"
on public.sessions
for insert
to authenticated
with check (true);

create policy "Authenticated users can update session activity"
on public.sessions
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can read session participants"
on public.session_participants
for select
to authenticated
using (true);

create policy "Users can insert their own session participant row"
on public.session_participants
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own session participant row"
on public.session_participants
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own session participant row"
on public.session_participants
for delete
to authenticated
using (user_id = auth.uid());

create policy "Users can read their sung song events"
on public.sung_song_events
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert their sung song events"
on public.sung_song_events
for insert
to authenticated
with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'session_participants'
    ) then
      alter publication supabase_realtime add table public.session_participants;
    end if;
  end if;
end $$;
