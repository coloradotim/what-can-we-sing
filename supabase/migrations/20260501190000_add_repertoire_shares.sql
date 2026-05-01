create table if not exists public.repertoire_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz
);

create unique index if not exists repertoire_shares_code_key
on public.repertoire_shares (code);

create index if not exists repertoire_shares_owner_active_idx
on public.repertoire_shares (owner_id, created_at desc)
where revoked_at is null;

alter table public.repertoire_shares enable row level security;

grant select, insert, update on public.repertoire_shares to authenticated;

drop policy if exists "Users can read their own repertoire shares"
on public.repertoire_shares;
drop policy if exists "Users can create their own repertoire shares"
on public.repertoire_shares;
drop policy if exists "Users can update their own repertoire shares"
on public.repertoire_shares;

create policy "Users can read their own repertoire shares"
on public.repertoire_shares
for select
to authenticated
using (owner_id = auth.uid());

create policy "Users can create their own repertoire shares"
on public.repertoire_shares
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Users can update their own repertoire shares"
on public.repertoire_shares
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create or replace function public.get_shared_repertoire(p_code text)
returns table (
  share_id uuid,
  code text,
  owner_display_name text,
  song_id uuid,
  song_title text,
  voicing text,
  arranger_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    repertoire_shares.id as share_id,
    repertoire_shares.code,
    profiles.display_name as owner_display_name,
    user_repertoire.id as song_id,
    user_repertoire.song_title,
    user_repertoire.voicing,
    user_repertoire.arranger_name
  from public.repertoire_shares
  join public.profiles
    on profiles.id = repertoire_shares.owner_id
  left join public.user_repertoire
    on user_repertoire.user_id = repertoire_shares.owner_id
  where repertoire_shares.code = upper(btrim(p_code))
    and repertoire_shares.revoked_at is null
    and (
      repertoire_shares.expires_at is null
      or repertoire_shares.expires_at > now()
    )
  order by
    user_repertoire.song_title asc nulls last,
    user_repertoire.voicing asc nulls last,
    user_repertoire.arranger_name asc nulls first;
end;
$$;

revoke all on function public.get_shared_repertoire(text) from public;
grant execute on function public.get_shared_repertoire(text) to anon;
grant execute on function public.get_shared_repertoire(text) to authenticated;
