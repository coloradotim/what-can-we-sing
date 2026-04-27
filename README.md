# what-can-we-sing
An app to allow a pick-up barbershop quartet to quickly find songs they can sing together

## Environment variables

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your Supabase anon key
NEXT_PUBLIC_SITE_URL=https://your-production-app-url
```

`NEXT_PUBLIC_SITE_URL` is used for Supabase magic-link redirects in production. Set it to the deployed Vercel app URL, without a trailing path. If it is blank during local development, login links fall back to the current localhost origin.

Magic links redirect through `/auth/callback`, where the app exchanges the Supabase code for a session before sending the user to the intended page. In Supabase Auth URL configuration, add the production callback URL and any required local development callback URL to the allowed redirect URLs, such as:

```text
https://your-production-app-url/auth/callback
http://localhost:3000/auth/callback
```

## Supabase auth email

Hosted Supabase projects configure Auth email templates in the Supabase dashboard, not in this repo. Use the recommended Magic Link template in [docs/auth-email-template.md](docs/auth-email-template.md) so login emails are clearly branded as What Can We Sing and include a button plus fallback link.

## Supabase database

Session participants are keyed by the authenticated Supabase user so one singer can refresh their repertoire without creating duplicate rows, while different singers with the same display name can still join the same quartet.

If your `session_participants` table does not already have `user_id` and a unique constraint for each user in each session, run this in the Supabase SQL editor:

```sql
alter table public.session_participants
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

delete from public.session_participants
where user_id is null;

alter table public.session_participants
  alter column user_id set not null;

create unique index if not exists session_participants_session_user_unique
  on public.session_participants (session_id, user_id);
```

The delete only clears participant snapshots created before `user_id` existed; singers can rejoin active quartets to recreate their current snapshots.
