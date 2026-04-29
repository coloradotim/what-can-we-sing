do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'song_suggestion_catalog_supported_voicing_chk'
      and conrelid = 'public.song_suggestion_catalog'::regclass
  ) then
    alter table public.song_suggestion_catalog
      add constraint song_suggestion_catalog_supported_voicing_chk
      check (voicing in ('TTBB', 'SATB', 'SSAA')) not valid;
  end if;
end $$;

create or replace function public.search_repertoire_song_suggestions(
  p_query text,
  p_limit integer default 10
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
    select
      btrim(coalesce(p_query, '')) as raw_query,
      btrim(
        lower(
          regexp_replace(coalesce(p_query, ''), '[^[:alnum:]]+', ' ', 'g')
        )
      ) as query
  ),
  user_suggestions as (
    select distinct
      btrim(user_repertoire.song_title) as song_title,
      user_repertoire.voicing,
      nullif(btrim(coalesce(user_repertoire.arranger_name, '')), '') as arranger_name,
      lower(regexp_replace(user_repertoire.song_title, '[^[:alnum:]]+', ' ', 'g')) as normalized_title,
      1 as source_rank
    from public.user_repertoire
    cross join normalized_input
    where auth.role() = 'authenticated'
      and length(normalized_input.query) >= 2
      and btrim(user_repertoire.song_title) <> ''
      and user_repertoire.voicing in ('TTBB', 'SATB', 'SSAA')
      and (
        lower(regexp_replace(user_repertoire.song_title, '[^[:alnum:]]+', ' ', 'g'))
          like '%' || normalized_input.query || '%'
        or lower(regexp_replace(coalesce(user_repertoire.arranger_name, ''), '[^[:alnum:]]+', ' ', 'g'))
          like '%' || normalized_input.query || '%'
      )
  ),
  catalog_suggestions as (
    select distinct
      btrim(song_suggestion_catalog.title) as song_title,
      song_suggestion_catalog.voicing,
      nullif(btrim(coalesce(song_suggestion_catalog.arranger, '')), '') as arranger_name,
      song_suggestion_catalog.normalized_title,
      2 as source_rank
    from public.song_suggestion_catalog
    cross join normalized_input
    where auth.role() = 'authenticated'
      and length(normalized_input.query) >= 2
      and btrim(song_suggestion_catalog.title) <> ''
      and song_suggestion_catalog.voicing in ('TTBB', 'SATB', 'SSAA')
      and (
        song_suggestion_catalog.normalized_title like normalized_input.query || '%'
        or song_suggestion_catalog.normalized_title like '%' || normalized_input.query || '%'
        or song_suggestion_catalog.title ilike '%' || normalized_input.raw_query || '%'
        or coalesce(song_suggestion_catalog.normalized_arranger, '')
          like '%' || normalized_input.query || '%'
      )
  ),
  combined_suggestions as (
    select * from user_suggestions
    union all
    select * from catalog_suggestions
  ),
  deduped_suggestions as (
    select
      combined_suggestions.song_title,
      combined_suggestions.voicing,
      combined_suggestions.arranger_name,
      combined_suggestions.normalized_title,
      min(combined_suggestions.source_rank) as source_rank
    from combined_suggestions
    group by
      combined_suggestions.song_title,
      combined_suggestions.voicing,
      combined_suggestions.arranger_name,
      combined_suggestions.normalized_title
  )
  select
    deduped_suggestions.song_title,
    deduped_suggestions.voicing,
    deduped_suggestions.arranger_name
  from deduped_suggestions
  order by
    case
      when deduped_suggestions.normalized_title = (select query from normalized_input) then 0
      when deduped_suggestions.normalized_title like (select query from normalized_input) || '%' then 1
      else 2
    end,
    deduped_suggestions.source_rank,
    deduped_suggestions.song_title,
    deduped_suggestions.voicing,
    deduped_suggestions.arranger_name nulls first
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;

revoke all on function public.search_repertoire_song_suggestions(text, integer) from public;
revoke all on function public.search_repertoire_song_suggestions(text, integer) from anon;
grant execute on function public.search_repertoire_song_suggestions(text, integer) to authenticated;
