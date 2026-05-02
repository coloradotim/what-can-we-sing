alter table public.sung_song_events
  alter column session_id drop not null;

create or replace function public.mark_repertoire_sung(
  p_repertoire_id uuid,
  p_session_id uuid default null
)
returns public.user_repertoire
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_repertoire public.user_repertoire;
begin
  update public.user_repertoire
  set
    last_sung_at = now(),
    times_sung_count = times_sung_count + 1,
    updated_at = now()
  where id = p_repertoire_id
    and user_id = auth.uid()
  returning * into updated_repertoire;

  if updated_repertoire.id is null then
    raise exception 'Could not mark repertoire song as sung'
      using errcode = 'P0002';
  end if;

  insert into public.sung_song_events (
    user_id,
    session_id,
    song_title,
    voicing,
    arranger_name
  )
  values (
    updated_repertoire.user_id,
    p_session_id,
    updated_repertoire.song_title,
    updated_repertoire.voicing,
    updated_repertoire.arranger_name
  );

  return updated_repertoire;
end;
$$;

grant execute on function public.mark_repertoire_sung(uuid, uuid) to authenticated;
