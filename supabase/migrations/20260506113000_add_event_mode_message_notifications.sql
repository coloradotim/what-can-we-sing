create table if not exists public.event_mode_message_notifications (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.event_mode_messages(id) on delete cascade,
  event_id uuid not null references public.event_mode_events(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  provider_message_id text,
  error_status integer,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint event_mode_message_notifications_status_chk check (
    status in ('pending', 'sent', 'failed')
  )
);

create unique index if not exists event_mode_message_notifications_message_key
on public.event_mode_message_notifications (message_id);

create index if not exists event_mode_message_notifications_event_created_idx
on public.event_mode_message_notifications (event_id, created_at desc);

alter table public.event_mode_message_notifications enable row level security;

revoke all on table public.event_mode_message_notifications from anon;
revoke all on table public.event_mode_message_notifications from authenticated;
