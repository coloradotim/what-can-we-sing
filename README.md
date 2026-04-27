# what-can-we-sing
An app to allow a pick-up barbershop quartet to quickly find songs they can sing together

## Environment variables

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your Supabase anon key
NEXT_PUBLIC_SITE_URL=https://your-production-app-url
NEXT_PUBLIC_POSTHOG_KEY=your PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST=your PostHog host URL
```

`NEXT_PUBLIC_SITE_URL` is used for Supabase magic-link redirects in production. Set it to the deployed Vercel app URL, without a trailing path. If it is blank during local development, login links fall back to the current localhost origin.

`NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` enable optional product analytics. Leave them blank to disable analytics in local development. Analytics events use counts, IDs, and booleans only; free-text repertoire notes, feedback text, song titles, arranger names, names, and email addresses should not be sent to PostHog.

Magic links redirect through `/auth/callback`, where the app exchanges the Supabase code for a session before sending the user to the intended page. In Supabase Auth URL configuration, add the production callback URL and any required local development callback URL to the allowed redirect URLs, such as:

```text
https://your-production-app-url/auth/callback
http://localhost:3000/auth/callback
```

## Supabase auth email

Hosted Supabase projects configure Auth email templates in the Supabase dashboard, not in this repo. Use the recommended Magic Link template in [docs/auth-email-template.md](docs/auth-email-template.md) so login emails are clearly branded as What Can We Sing and include a button plus fallback link.

## Supabase database

The Supabase project should have the current production schema applied:

- `profiles` stores each user's required `display_name`.
- `user_repertoire` stores each user's songs, voicing, parts known, confidence,
  optional arranger name, and private notes.
- `sessions` stores quartet codes and `last_activity_at` for 24-hour inactivity
  expiration.
- `session_participants` stores participant repertoire snapshots and is keyed by
  `(session_id, user_id)` so one singer can refresh without creating duplicate
  rows.
- `sung_song_events` stores each user's private "marked as sung" events for
  recent-use indicators.

One-time migration SQL is intentionally not kept in this README after it has
been applied. Add any future schema change to the PR that introduces it, then
remove the one-time instructions after production is updated.

For the private repertoire notes feature, apply the one-time SQL in
[docs/private-repertoire-notes.md](docs/private-repertoire-notes.md).

For the recently sung feature, apply the one-time SQL in
[docs/recently-sung-events.md](docs/recently-sung-events.md).
