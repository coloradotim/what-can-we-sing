create table if not exists public.event_mode_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  normalized_name text not null,
  city text,
  venue_or_location_note text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  visibility text not null default 'listed',
  join_code text not null check (join_code ~ '^[A-Z0-9]{6}$'),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint event_mode_events_time_order_chk check (end_at > start_at),
  constraint event_mode_events_visibility_chk check (
    visibility in ('listed', 'unlisted')
  )
);

create unique index if not exists event_mode_events_join_code_key
on public.event_mode_events (join_code);

create index if not exists event_mode_events_browse_idx
on public.event_mode_events (visibility, start_at, end_at)
where closed_at is null;

create index if not exists event_mode_events_creator_idx
on public.event_mode_events (created_by_user_id, start_at desc);

create index if not exists event_mode_events_normalized_name_idx
on public.event_mode_events (normalized_name);

alter table public.event_mode_events enable row level security;

grant select, insert, update on public.event_mode_events to authenticated;

drop policy if exists "Signed-in users can read listed event mode events"
on public.event_mode_events;
drop policy if exists "Users can create their own event mode events"
on public.event_mode_events;
drop policy if exists "Event creators can update their own event mode events"
on public.event_mode_events;

create policy "Signed-in users can read listed event mode events"
on public.event_mode_events
for select
to authenticated
using (
  visibility = 'listed'
  or created_by_user_id = auth.uid()
);

create policy "Users can create their own event mode events"
on public.event_mode_events
for insert
to authenticated
with check (created_by_user_id = auth.uid());

create policy "Event creators can update their own event mode events"
on public.event_mode_events
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (created_by_user_id = auth.uid());

create or replace function public.get_event_mode_event_by_code(p_code text)
returns table (
  id uuid,
  name text,
  normalized_name text,
  city text,
  venue_or_location_note text,
  start_at timestamptz,
  end_at timestamptz,
  visibility text,
  join_code text,
  created_by_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event_mode_events.id,
    event_mode_events.name,
    event_mode_events.normalized_name,
    event_mode_events.city,
    event_mode_events.venue_or_location_note,
    event_mode_events.start_at,
    event_mode_events.end_at,
    event_mode_events.visibility,
    event_mode_events.join_code,
    event_mode_events.created_by_user_id,
    event_mode_events.created_at,
    event_mode_events.updated_at,
    event_mode_events.closed_at
  from public.event_mode_events
  where event_mode_events.join_code = upper(btrim(p_code))
  limit 1;
$$;

revoke all on function public.get_event_mode_event_by_code(text) from public;
grant execute on function public.get_event_mode_event_by_code(text) to anon;
grant execute on function public.get_event_mode_event_by_code(text) to authenticated;
