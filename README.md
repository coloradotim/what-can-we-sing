# what-can-we-sing
An app to allow a pick-up barbershop quartet to quickly find songs they can sing together

## Environment variables

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your Supabase anon key
NEXT_PUBLIC_POSTHOG_KEY=your PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST=your PostHog host URL
RESEND_API_KEY=your Resend API key for server-side feedback email
FEEDBACK_FROM_EMAIL=What Can We Sing <feedback@your-verified-domain>
FEEDBACK_TO_EMAIL=feedback destination address
```

`NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` enable optional product analytics. Leave them blank to disable analytics in local development. Analytics events use counts, IDs, and booleans only; free-text repertoire notes, feedback text, song titles, arranger names, names, and email addresses should not be sent to PostHog.

`RESEND_API_KEY`, `FEEDBACK_FROM_EMAIL`, and `FEEDBACK_TO_EMAIL` are server-only
settings for the in-app feedback form. Configure them in Vercel, not as
`NEXT_PUBLIC_*` variables. For the current deployment, set
`FEEDBACK_TO_EMAIL` to the app owner address.

## Supabase auth email

Hosted Supabase projects configure Auth email templates in the Supabase
dashboard, not in this repo. Use the recommended one-time code template in
[docs/auth-email-template.md](docs/auth-email-template.md) so login emails are
clearly branded as What Can We Sing and do not rely on clickable magic links.

For production login-code delivery, configure Supabase Auth custom SMTP with
Resend using [docs/supabase-resend-smtp.md](docs/supabase-resend-smtp.md).
SMTP credentials must stay in Supabase only; do not add them to frontend code,
this repository, or Vercel environment variables.

After changing auth settings or email templates, run the manual checklist in
[docs/auth-manual-test-checklist.md](docs/auth-manual-test-checklist.md).

## Supabase database

The Supabase project should have the current production schema applied:

- `profiles` stores each user's required `display_name`.
- `user_repertoire` stores each user's songs, voicing, part/confidence pairs,
  optional arranger name, private notes, and personal sung-count metadata.
- `sessions` stores quartet codes and `last_activity_at` for 24-hour inactivity
  expiration.
- `session_participants` stores participant repertoire snapshots and is keyed by
  `(session_id, user_id)` so one singer can refresh without creating duplicate
  rows. Supabase Realtime must be enabled for this table so joined clients see
  participant insert, update, and delete changes immediately.
- `sung_song_events` stores each user's private "marked as sung" events for
  recent-use indicators. Marking a song as sung is performed through the
  `mark_repertoire_sung` database function so repertoire metadata and the event
  log stay in sync.

The app/database contract is documented in
[docs/supabase-contract.md](docs/supabase-contract.md). Any PR that changes
Supabase usage must update that contract, migrations, and tests or test notes.

Database migrations live in `supabase/migrations`. Apply unapplied migrations
to the linked Supabase project with:

```bash
supabase db push
```

If the project is not linked locally, run `supabase link --project-ref <project-ref>`
first, then `supabase db push`.
