create or replace function public.join_session_participant(
  p_session_id uuid,
  p_display_name text,
  p_repertoire jsonb,
  p_last_activity_at timestamptz default now(),
  p_max_participants integer default 4
)
returns public.session_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_participant public.session_participants%rowtype;
  saved_participant public.session_participants%rowtype;
  active_participant_count integer;
begin
  if current_user_id is null then
    raise exception 'You must be logged in to join a quartet.';
  end if;

  perform 1
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Could not find that quartet.';
  end if;

  select *
  into existing_participant
  from public.session_participants
  where session_id = p_session_id
    and user_id = current_user_id;

  if existing_participant.id is null then
    select count(*)
    into active_participant_count
    from public.session_participants
    where session_id = p_session_id;

    if active_participant_count >= least(greatest(coalesce(p_max_participants, 4), 1), 4) then
      raise exception 'This quartet is already full.';
    end if;
  end if;

  insert into public.session_participants (
    session_id,
    user_id,
    display_name,
    repertoire
  )
  values (
    p_session_id,
    current_user_id,
    btrim(p_display_name),
    coalesce(p_repertoire, '[]'::jsonb)
  )
  on conflict (session_id, user_id)
  do update set
    display_name = excluded.display_name,
    repertoire = excluded.repertoire
  returning *
  into saved_participant;

  update public.sessions
  set last_activity_at = coalesce(p_last_activity_at, now())
  where id = p_session_id;

  return saved_participant;
end;
$$;

revoke all on function public.join_session_participant(
  uuid,
  text,
  jsonb,
  timestamptz,
  integer
) from public;
revoke all on function public.join_session_participant(
  uuid,
  text,
  jsonb,
  timestamptz,
  integer
) from anon;
grant execute on function public.join_session_participant(
  uuid,
  text,
  jsonb,
  timestamptz,
  integer
) to authenticated;
