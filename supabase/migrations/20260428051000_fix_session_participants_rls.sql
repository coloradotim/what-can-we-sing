alter table public.session_participants enable row level security;

grant select, insert, update, delete on public.session_participants to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'session_participants'
  loop
    execute format(
      'drop policy if exists %I on public.session_participants',
      policy_record.policyname
    );
  end loop;
end $$;

create policy "Authenticated users can read session participants"
on public.session_participants
for select
to authenticated
using (true);

create policy "Users can insert their own session participant row"
on public.session_participants
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own session participant row"
on public.session_participants
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own session participant row"
on public.session_participants
for delete
to authenticated
using (user_id = auth.uid());
