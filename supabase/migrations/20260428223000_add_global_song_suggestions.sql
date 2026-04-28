drop function if exists public.search_repertoire_song_suggestions(text, integer);

create or replace function public.search_repertoire_song_suggestions(
  p_query text,
  p_limit integer default 6
)
returns table (
  song_title text,
  voicing text,
  arranger_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized_input as (
    select lower(
      regexp_replace(coalesce(p_query, ''), '[^[:alnum:]]+', ' ', 'g')
    ) as query
  ),
  suggestions as (
    select distinct
      btrim(user_repertoire.song_title) as song_title,
      user_repertoire.voicing,
      nullif(btrim(coalesce(user_repertoire.arranger_name, '')), '') as arranger_name
    from public.user_repertoire
    cross join normalized_input
    where auth.role() = 'authenticated'
      and length(normalized_input.query) >= 2
      and btrim(user_repertoire.song_title) <> ''
      and (
        lower(regexp_replace(user_repertoire.song_title, '[^[:alnum:]]+', ' ', 'g'))
          like '%' || normalized_input.query || '%'
        or lower(regexp_replace(coalesce(user_repertoire.arranger_name, ''), '[^[:alnum:]]+', ' ', 'g'))
          like '%' || normalized_input.query || '%'
      )
  )
  select suggestions.song_title, suggestions.voicing, suggestions.arranger_name
  from suggestions
  order by suggestions.song_title, suggestions.voicing, suggestions.arranger_name nulls first
  limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

revoke all on function public.search_repertoire_song_suggestions(text, integer) from public;
revoke all on function public.search_repertoire_song_suggestions(text, integer) from anon;
grant execute on function public.search_repertoire_song_suggestions(text, integer) to authenticated;
