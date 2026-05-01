alter table public.profiles
add column if not exists has_dismissed_quartet_nudge boolean not null default false;
