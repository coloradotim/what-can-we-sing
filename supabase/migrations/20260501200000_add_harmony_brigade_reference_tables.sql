create extension if not exists pgcrypto;

create table if not exists public.harmony_brigade_songs (
  id uuid primary key default gen_random_uuid(),
  source_song_id integer not null unique,
  song_title text not null,
  normalized_title text not null,
  arranger text,
  normalized_arranger text,
  default_voicing text not null default 'TTBB',
  song_key text,
  starting_words text,
  as_sung_by text,
  learning_track_provider text,
  song_style text,
  song_length text,
  difficulty text,
  genre text,
  tempo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint harmony_brigade_songs_default_voicing_chk
    check (default_voicing = 'TTBB')
);

create table if not exists public.harmony_brigade_events (
  id uuid primary key default gen_random_uuid(),
  year_held integer not null,
  brigade_abbr text not null,
  brigade_name text,
  event_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.harmony_brigade_event_songs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.harmony_brigade_events(id) on delete cascade,
  song_id uuid not null references public.harmony_brigade_songs(id) on delete cascade,
  track_number integer,
  sort_order integer,
  created_at timestamptz not null default now()
);

alter table public.harmony_brigade_songs enable row level security;
alter table public.harmony_brigade_events enable row level security;
alter table public.harmony_brigade_event_songs enable row level security;

create unique index if not exists harmony_brigade_events_year_abbr_idx
on public.harmony_brigade_events (year_held, brigade_abbr);

create unique index if not exists harmony_brigade_event_songs_unique_idx
on public.harmony_brigade_event_songs (event_id, song_id);

create index if not exists harmony_brigade_songs_normalized_title_idx
on public.harmony_brigade_songs (normalized_title);

create index if not exists harmony_brigade_songs_normalized_arranger_idx
on public.harmony_brigade_songs (normalized_arranger);

create index if not exists harmony_brigade_events_year_idx
on public.harmony_brigade_events (year_held desc);

create index if not exists harmony_brigade_events_abbr_idx
on public.harmony_brigade_events (brigade_abbr);

create index if not exists harmony_brigade_event_songs_event_idx
on public.harmony_brigade_event_songs (event_id, sort_order, track_number);

drop policy if exists "Authenticated users can read harmony brigade songs"
on public.harmony_brigade_songs;
drop policy if exists "Authenticated users can read harmony brigade events"
on public.harmony_brigade_events;
drop policy if exists "Authenticated users can read harmony brigade event songs"
on public.harmony_brigade_event_songs;

create policy "Authenticated users can read harmony brigade songs"
on public.harmony_brigade_songs
for select
to authenticated
using (true);

create policy "Authenticated users can read harmony brigade events"
on public.harmony_brigade_events
for select
to authenticated
using (true);

create policy "Authenticated users can read harmony brigade event songs"
on public.harmony_brigade_event_songs
for select
to authenticated
using (true);
