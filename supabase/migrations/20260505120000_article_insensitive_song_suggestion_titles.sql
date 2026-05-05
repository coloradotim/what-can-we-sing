with normalized_catalog_rows as (
  select
    id,
    coalesce(
      nullif(
        regexp_replace(
          btrim(
            lower(
              regexp_replace(
                regexp_replace(title, '^(.*),\s*(the|a|an)$', '\2 \1', 'i'),
                '[^[:alnum:]]+',
                ' ',
                'g'
              )
            )
          ),
          '^(a|an|the)[[:space:]]+',
          '',
          'i'
        ),
        ''
      ),
      normalized_title
    ) as article_insensitive_title
  from public.song_suggestion_catalog
),
duplicate_catalog_rows as (
  select
    id,
    row_number() over (
      partition by
        article_insensitive_title,
        voicing,
        coalesce(normalized_arranger, '')
      order by length(title) desc, title, id
    ) as duplicate_rank
  from normalized_catalog_rows
  join public.song_suggestion_catalog using (id)
)
delete from public.song_suggestion_catalog
using duplicate_catalog_rows
where song_suggestion_catalog.id = duplicate_catalog_rows.id
  and duplicate_catalog_rows.duplicate_rank > 1;

update public.song_suggestion_catalog
set normalized_title = coalesce(
  nullif(
    regexp_replace(
      btrim(
        lower(
          regexp_replace(
            regexp_replace(title, '^(.*),\s*(the|a|an)$', '\2 \1', 'i'),
            '[^[:alnum:]]+',
            ' ',
            'g'
          )
        )
      ),
      '^(a|an|the)[[:space:]]+',
      '',
      'i'
    ),
    ''
  ),
  normalized_title
);

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
      raw_query,
      query,
      coalesce(
        nullif(
          regexp_replace(query, '^(a|an|the)[[:space:]]+', '', 'i'),
          ''
        ),
        query
      ) as title_query
    from (
      select
        btrim(coalesce(p_query, '')) as raw_query,
        btrim(
          lower(
            regexp_replace(coalesce(p_query, ''), '[^[:alnum:]]+', ' ', 'g')
          )
        ) as query
    ) normalized_query
  ),
  user_suggestions as (
    select distinct
      btrim(user_repertoire.song_title) as song_title,
      user_repertoire.voicing,
      nullif(btrim(coalesce(user_repertoire.arranger_name, '')), '') as arranger_name,
      coalesce(
        nullif(
          regexp_replace(
            btrim(
              lower(
                regexp_replace(
                  regexp_replace(user_repertoire.song_title, '^(.*),\s*(the|a|an)$', '\2 \1', 'i'),
                  '[^[:alnum:]]+',
                  ' ',
                  'g'
                )
              )
            ),
            '^(a|an|the)[[:space:]]+',
            '',
            'i'
          ),
          ''
        ),
        lower(regexp_replace(user_repertoire.song_title, '[^[:alnum:]]+', ' ', 'g'))
      ) as normalized_title,
      1 as source_rank
    from public.user_repertoire
    cross join normalized_input
    where auth.role() = 'authenticated'
      and length(normalized_input.query) >= 2
      and btrim(user_repertoire.song_title) <> ''
      and user_repertoire.voicing in ('TTBB', 'SATB', 'SSAA')
      and (
        coalesce(
          nullif(
            regexp_replace(
              btrim(
                lower(
                  regexp_replace(
                    regexp_replace(user_repertoire.song_title, '^(.*),\s*(the|a|an)$', '\2 \1', 'i'),
                    '[^[:alnum:]]+',
                    ' ',
                    'g'
                  )
                )
              ),
              '^(a|an|the)[[:space:]]+',
              '',
              'i'
            ),
            ''
          ),
          lower(regexp_replace(user_repertoire.song_title, '[^[:alnum:]]+', ' ', 'g'))
        ) like '%' || normalized_input.title_query || '%'
        or lower(regexp_replace(user_repertoire.song_title, '[^[:alnum:]]+', ' ', 'g'))
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
        song_suggestion_catalog.normalized_title like normalized_input.title_query || '%'
        or song_suggestion_catalog.normalized_title like '%' || normalized_input.title_query || '%'
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
      when deduped_suggestions.normalized_title = (select title_query from normalized_input) then 0
      when deduped_suggestions.normalized_title like (select title_query from normalized_input) || '%' then 1
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
