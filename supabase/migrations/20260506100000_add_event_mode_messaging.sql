create table if not exists public.event_mode_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_mode_events(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_availability_id uuid references public.event_mode_availability(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint event_mode_messages_no_self_message_chk check (sender_user_id <> recipient_user_id)
);

create index if not exists event_mode_messages_event_created_idx
on public.event_mode_messages (event_id, created_at desc);

create index if not exists event_mode_messages_sender_event_idx
on public.event_mode_messages (sender_user_id, event_id, created_at desc);

create index if not exists event_mode_messages_recipient_event_idx
on public.event_mode_messages (recipient_user_id, event_id, created_at desc);

create table if not exists public.event_mode_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.event_mode_messages(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.event_mode_events(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint event_mode_message_reports_reason_len_chk check (
    reason is null or length(btrim(reason)) <= 500
  )
);

create unique index if not exists event_mode_message_reports_message_reporter_key
on public.event_mode_message_reports (message_id, reporter_user_id);

create index if not exists event_mode_message_reports_event_idx
on public.event_mode_message_reports (event_id, created_at desc);

create table if not exists public.event_mode_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_mode_events(id) on delete cascade,
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_mode_blocks_no_self_block_chk check (blocker_user_id <> blocked_user_id)
);

create unique index if not exists event_mode_blocks_event_blocker_blocked_key
on public.event_mode_blocks (event_id, blocker_user_id, blocked_user_id);

create index if not exists event_mode_blocks_blocked_event_idx
on public.event_mode_blocks (blocked_user_id, event_id);

alter table public.event_mode_messages enable row level security;
alter table public.event_mode_message_reports enable row level security;
alter table public.event_mode_blocks enable row level security;

grant select on public.event_mode_messages to authenticated;
grant select on public.event_mode_message_reports to authenticated;
grant select on public.event_mode_blocks to authenticated;

drop policy if exists "Users can read their own event mode messages"
on public.event_mode_messages;
drop policy if exists "Users can read their own event mode message reports"
on public.event_mode_message_reports;
drop policy if exists "Users can read their own event mode blocks"
on public.event_mode_blocks;

create policy "Users can read their own event mode messages"
on public.event_mode_messages
for select
to authenticated
using (
  sender_user_id = auth.uid()
  or recipient_user_id = auth.uid()
);

create policy "Users can read their own event mode message reports"
on public.event_mode_message_reports
for select
to authenticated
using (reporter_user_id = auth.uid());

create policy "Users can read their own event mode blocks"
on public.event_mode_blocks
for select
to authenticated
using (blocker_user_id = auth.uid());

create or replace function public.event_mode_user_can_message(
  p_event_id uuid,
  p_sender_user_id uuid,
  p_recipient_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_sender_user_id is not null
    and p_recipient_user_id is not null
    and p_sender_user_id <> p_recipient_user_id
    and exists (
      select 1
      from public.event_mode_events
      where event_mode_events.id = p_event_id
        and event_mode_events.closed_at is null
        and event_mode_events.end_at > now()
    )
    and not exists (
      select 1
      from public.event_mode_blocks
      where event_mode_blocks.event_id = p_event_id
        and event_mode_blocks.blocker_user_id = p_recipient_user_id
        and event_mode_blocks.blocked_user_id = p_sender_user_id
    )
    and (
      exists (
        select 1
        from public.event_mode_availability
        where event_mode_availability.event_id = p_event_id
          and event_mode_availability.user_id = p_recipient_user_id
          and event_mode_availability.turned_off_at is null
          and event_mode_availability.available_until > now()
      )
      or exists (
        select 1
        from public.event_mode_messages
        where event_mode_messages.event_id = p_event_id
          and (
            (
              event_mode_messages.sender_user_id = p_sender_user_id
              and event_mode_messages.recipient_user_id = p_recipient_user_id
            )
            or (
              event_mode_messages.sender_user_id = p_recipient_user_id
              and event_mode_messages.recipient_user_id = p_sender_user_id
            )
          )
      )
    );
$$;

revoke all on function public.event_mode_user_can_message(uuid, uuid, uuid) from public;

create or replace function public.send_event_mode_message(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_body text,
  p_recipient_availability_id uuid default null
)
returns table (
  id uuid,
  event_id uuid,
  sender_user_id uuid,
  sender_display_name text,
  recipient_user_id uuid,
  recipient_display_name text,
  recipient_availability_id uuid,
  body text,
  created_at timestamptz,
  read_at timestamptz,
  reported_by_me boolean,
  blocked_by_me boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.role() <> 'authenticated' or v_user_id is null then
    raise exception 'You must be logged in to send a message.';
  end if;

  if length(v_body) = 0 then
    raise exception 'Message is required.';
  end if;

  if length(v_body) > 1000 then
    raise exception 'Message must be 1000 characters or fewer.';
  end if;

  if not public.event_mode_user_can_message(p_event_id, v_user_id, p_recipient_user_id) then
    raise exception 'You cannot message that singer for this event.';
  end if;

  if p_recipient_availability_id is not null and not exists (
    select 1
    from public.event_mode_availability
    where event_mode_availability.id = p_recipient_availability_id
      and event_mode_availability.event_id = p_event_id
      and event_mode_availability.user_id = p_recipient_user_id
  ) then
    raise exception 'That availability record is not part of this event.';
  end if;

  insert into public.event_mode_messages (
    event_id,
    sender_user_id,
    recipient_user_id,
    recipient_availability_id,
    body
  )
  values (
    p_event_id,
    v_user_id,
    p_recipient_user_id,
    p_recipient_availability_id,
    v_body
  )
  returning event_mode_messages.id into v_message_id;

  return query
  select
    event_mode_messages.id,
    event_mode_messages.event_id,
    event_mode_messages.sender_user_id,
    sender_profiles.display_name as sender_display_name,
    event_mode_messages.recipient_user_id,
    recipient_profiles.display_name as recipient_display_name,
    event_mode_messages.recipient_availability_id,
    event_mode_messages.body,
    event_mode_messages.created_at,
    event_mode_messages.read_at,
    false as reported_by_me,
    false as blocked_by_me
  from public.event_mode_messages
  join public.profiles sender_profiles
    on sender_profiles.id = event_mode_messages.sender_user_id
  join public.profiles recipient_profiles
    on recipient_profiles.id = event_mode_messages.recipient_user_id
  where event_mode_messages.id = v_message_id;
end;
$$;

create or replace function public.get_event_mode_messages_by_code(p_code text)
returns table (
  id uuid,
  event_id uuid,
  sender_user_id uuid,
  sender_display_name text,
  recipient_user_id uuid,
  recipient_display_name text,
  recipient_availability_id uuid,
  body text,
  created_at timestamptz,
  read_at timestamptz,
  reported_by_me boolean,
  blocked_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event_mode_messages.id,
    event_mode_messages.event_id,
    event_mode_messages.sender_user_id,
    sender_profiles.display_name as sender_display_name,
    event_mode_messages.recipient_user_id,
    recipient_profiles.display_name as recipient_display_name,
    event_mode_messages.recipient_availability_id,
    event_mode_messages.body,
    event_mode_messages.created_at,
    event_mode_messages.read_at,
    exists (
      select 1
      from public.event_mode_message_reports
      where event_mode_message_reports.message_id = event_mode_messages.id
        and event_mode_message_reports.reporter_user_id = auth.uid()
    ) as reported_by_me,
    exists (
      select 1
      from public.event_mode_blocks
      where event_mode_blocks.event_id = event_mode_messages.event_id
        and event_mode_blocks.blocker_user_id = auth.uid()
        and event_mode_blocks.blocked_user_id = case
          when event_mode_messages.sender_user_id = auth.uid()
            then event_mode_messages.recipient_user_id
          else event_mode_messages.sender_user_id
        end
    ) as blocked_by_me
  from public.event_mode_messages
  join public.event_mode_events
    on event_mode_events.id = event_mode_messages.event_id
  join public.profiles sender_profiles
    on sender_profiles.id = event_mode_messages.sender_user_id
  join public.profiles recipient_profiles
    on recipient_profiles.id = event_mode_messages.recipient_user_id
  where auth.role() = 'authenticated'
    and event_mode_events.join_code = upper(btrim(p_code))
    and (
      event_mode_messages.sender_user_id = auth.uid()
      or event_mode_messages.recipient_user_id = auth.uid()
    )
  order by event_mode_messages.created_at asc;
$$;

create or replace function public.report_event_mode_message(
  p_message_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.role() <> 'authenticated' or v_user_id is null then
    raise exception 'You must be logged in to report a message.';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'Report note must be 500 characters or fewer.';
  end if;

  select event_mode_messages.event_id
    into v_event_id
  from public.event_mode_messages
  where event_mode_messages.id = p_message_id
    and (
      event_mode_messages.sender_user_id = v_user_id
      or event_mode_messages.recipient_user_id = v_user_id
    );

  if v_event_id is null then
    raise exception 'You can only report messages you can view.';
  end if;

  insert into public.event_mode_message_reports (
    message_id,
    reporter_user_id,
    event_id,
    reason
  )
  values (
    p_message_id,
    v_user_id,
    v_event_id,
    v_reason
  )
  on conflict (message_id, reporter_user_id)
  do update set reason = excluded.reason;
end;
$$;

create or replace function public.block_event_mode_user(
  p_event_id uuid,
  p_blocked_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if auth.role() <> 'authenticated' or v_user_id is null then
    raise exception 'You must be logged in to block a user.';
  end if;

  if v_user_id = p_blocked_user_id then
    raise exception 'You cannot block yourself.';
  end if;

  if not exists (
    select 1
    from public.event_mode_events
    where event_mode_events.id = p_event_id
  ) then
    raise exception 'Event not found.';
  end if;

  if not exists (
    select 1
    from public.event_mode_messages
    where event_mode_messages.event_id = p_event_id
      and (
        (
          event_mode_messages.sender_user_id = v_user_id
          and event_mode_messages.recipient_user_id = p_blocked_user_id
        )
        or (
          event_mode_messages.sender_user_id = p_blocked_user_id
          and event_mode_messages.recipient_user_id = v_user_id
        )
      )
  ) and not exists (
    select 1
    from public.event_mode_availability
    where event_mode_availability.event_id = p_event_id
      and event_mode_availability.user_id = p_blocked_user_id
  ) then
    raise exception 'You can only block Event Mode users connected to this event.';
  end if;

  insert into public.event_mode_blocks (
    event_id,
    blocker_user_id,
    blocked_user_id
  )
  values (
    p_event_id,
    v_user_id,
    p_blocked_user_id
  )
  on conflict (event_id, blocker_user_id, blocked_user_id) do nothing;
end;
$$;

revoke all on function public.send_event_mode_message(uuid, uuid, text, uuid) from public;
revoke all on function public.get_event_mode_messages_by_code(text) from public;
revoke all on function public.report_event_mode_message(uuid, text) from public;
revoke all on function public.block_event_mode_user(uuid, uuid) from public;

grant execute on function public.send_event_mode_message(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.get_event_mode_messages_by_code(text) to authenticated;
grant execute on function public.report_event_mode_message(uuid, text) to authenticated;
grant execute on function public.block_event_mode_user(uuid, uuid) to authenticated;
