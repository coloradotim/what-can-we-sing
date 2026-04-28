alter table public.user_repertoire
  add column if not exists part_confidences jsonb not null default '[]'::jsonb;

update public.user_repertoire
set part_confidences = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'part',
        part_name,
        'confidence',
        coalesce(confidence, 'Music Required')
      )
    )
    from unnest(parts_known) as part_name
  ),
  '[]'::jsonb
)
where part_confidences = '[]'::jsonb;
