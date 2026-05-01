alter table public.profiles
add column if not exists has_seen_welcome boolean not null default false;
