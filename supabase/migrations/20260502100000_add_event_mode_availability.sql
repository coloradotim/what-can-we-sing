create table if not exists public.event_mode_availability (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_mode_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_parts text[] not null default '{}'::text[],
  availability_note text,
  meetup_note text,
  available_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  turned_off_at timestamptz,
  constraint event_mode_availability_voice_parts_nonempty_chk check (
    cardinality(voice_parts) > 0
  ),
  constraint event_mode_availability_voice_parts_supported_chk check (
    voice_parts <@ array[
      'TTBB Tenor',
      'TTBB Lead',
      'TTBB Baritone',
      'TTBB Bass',
      'SATB Soprano',
      'SATB Alto',
      'SATB Tenor',
      'SATB Bass',
      'SSAA Soprano 1',
      'SSAA Soprano 2',
      'SSAA Alto 1',
      'SSAA Alto 2'
    ]::text[]
  )
);

create unique index if not exists event_mode_availability_event_user_key
on public.event_mode_availability (event_id, user_id);

create index if not exists event_mode_availability_active_idx
on public.event_mode_availability (event_id, available_until)
where turned_off_at is null;

alter table public.event_mode_availability enable row level security;

grant select, insert, update on public.event_mode_availability to authenticated;

drop policy if exists "Users can read their own event mode availability"
on public.event_mode_availability;
drop policy if exists "Users can read listed event mode availability"
on public.event_mode_availability;
drop policy if exists "Users can create their own event mode availability"
on public.event_mode_availability;
drop policy if exists "Users can update their own event mode availability"
on public.event_mode_availability;

create policy "Users can read their own event mode availability"
on public.event_mode_availability
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can read listed event mode availability"
on public.event_mode_availability
for select
to authenticated
using (
  turned_off_at is null
  and available_until > now()
  and exists (
    select 1
    from public.event_mode_events
    where event_mode_events.id = event_mode_availability.event_id
      and event_mode_events.visibility = 'listed'
      and event_mode_events.closed_at is null
      and event_mode_events.end_at > now()
  )
);

create policy "Users can create their own event mode availability"
on public.event_mode_availability
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own event mode availability"
on public.event_mode_availability
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.get_event_mode_availability_by_code(p_code text)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  display_name text,
  voice_parts text[],
  availability_note text,
  meetup_note text,
  available_until timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  turned_off_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event_mode_availability.id,
    event_mode_availability.event_id,
    event_mode_availability.user_id,
    profiles.display_name,
    event_mode_availability.voice_parts,
    event_mode_availability.availability_note,
    event_mode_availability.meetup_note,
    event_mode_availability.available_until,
    event_mode_availability.created_at,
    event_mode_availability.updated_at,
    event_mode_availability.turned_off_at
  from public.event_mode_availability
  join public.event_mode_events
    on event_mode_events.id = event_mode_availability.event_id
  join public.profiles
    on profiles.id = event_mode_availability.user_id
  where auth.role() = 'authenticated'
    and event_mode_events.join_code = upper(btrim(p_code))
    and event_mode_events.closed_at is null
    and event_mode_events.end_at > now()
    and event_mode_availability.turned_off_at is null
    and event_mode_availability.available_until > now()
  order by
    profiles.display_name asc,
    event_mode_availability.updated_at desc;
$$;

revoke all on function public.get_event_mode_availability_by_code(text) from public;
grant execute on function public.get_event_mode_availability_by_code(text) to authenticated;
