# Recently Sung Events

Issue #88 adds a private event log for songs a user marks as sung from quartet
results.

Apply this SQL once in the Supabase SQL editor before deploying the feature:

```sql
create table if not exists public.sung_song_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  song_title text not null,
  voicing text not null,
  arranger_name text,
  sung_at timestamptz not null default now()
);

alter table public.sung_song_events enable row level security;

create policy "Users can read their sung song events"
on public.sung_song_events
for select
using (auth.uid() = user_id);

create policy "Users can insert their sung song events"
on public.sung_song_events
for insert
with check (auth.uid() = user_id);

create index if not exists sung_song_events_user_sung_at_idx
on public.sung_song_events (user_id, sung_at desc);
```

Events are private to the user who marked the song. They are not copied into
quartet participant snapshots and do not affect matching rank yet.
