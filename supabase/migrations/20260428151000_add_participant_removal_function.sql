create or replace function public.remove_session_participant_by_id(
  p_session_id uuid,
  p_participant_id uuid
)
returns table (
  id uuid,
  session_id uuid,
  user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  removed_participant record;
begin
  if requester_id is null then
    raise exception 'You must be logged in to remove a quartet participant.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.session_participants requester
    where requester.session_id = p_session_id
      and requester.user_id = requester_id
  ) then
    raise exception 'You must be in the quartet to remove a participant.'
      using errcode = '42501';
  end if;

  delete from public.session_participants target
  where target.session_id = p_session_id
    and target.id = p_participant_id
  returning target.id, target.session_id, target.user_id
  into removed_participant;

  if removed_participant.id is null then
    raise exception 'Could not find the selected quartet participant row to delete.'
      using errcode = 'P0002';
  end if;

  id := removed_participant.id;
  session_id := removed_participant.session_id;
  user_id := removed_participant.user_id;
  return next;
end;
$$;

revoke all on function public.remove_session_participant_by_id(uuid, uuid)
from public;
grant execute on function public.remove_session_participant_by_id(uuid, uuid)
to authenticated;
