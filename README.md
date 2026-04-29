# what-can-we-sing

An app to allow a pick-up barbershop quartet to quickly find songs they can sing together

## Product model

What Can We Sing is optimized for in-the-room pickup quartet decisions. The
important question is "what can these singers sing right now?"

Current source-of-truth model:

- `profiles` stores the singer display name.
- `user_repertoire` stores each singer's saved songs, voicing, parts,
  per-part confidence values, optional arranger, private notes, and personal
  sung metadata.
- `sessions` stores quartet join codes and activity.
- `session_participants` stores active quartet membership and each singer's
  repertoire snapshot.

The quartet screen derives participants and matches from
`session_participants`. Local active-quartet state is only a navigation
shortcut, not the source of truth.

See [docs/app-flows.md](docs/app-flows.md) for the current start, join, rejoin,
leave, remove, repertoire refresh, and matching flow.

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
SUPABASE_SERVICE_ROLE_KEY=only for local/server catalog import scripts
```

`NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` enable optional product analytics. Leave them blank to disable analytics in local development. Analytics events use counts, IDs, and booleans only; free-text repertoire notes, feedback text, song titles, arranger names, names, and email addresses should not be sent to PostHog.

`RESEND_API_KEY`, `FEEDBACK_FROM_EMAIL`, and `FEEDBACK_TO_EMAIL` are server-only
settings for the in-app feedback form. Configure them in Vercel, not as
`NEXT_PUBLIC_*` variables. For the current deployment, set
`FEEDBACK_TO_EMAIL` to the app owner address.

The feedback destination email must never be rendered in the client or returned
from an API response.

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
- `song_suggestion_catalog` stores optional reference suggestions imported from
  `data/song_suggestion_catalog.psv`. It is used only for autocomplete; catalog
  rows are not added to anyone's repertoire unless a user chooses to save one.
  Import expands comma-separated voicing values into one row per supported
  voicing (`TTBB`, `SSAA`, `SATB`).

The app/database contract is documented in
[docs/supabase-contract.md](docs/supabase-contract.md). Any PR that changes
Supabase usage must update that contract, migrations, and tests or test notes.

Database migrations live in `supabase/migrations`. In production, migrations are
deployed by GitHub Actions after a migration PR is merged to `main`; see
[docs/deployment-automation.md](docs/deployment-automation.md). For local
development or emergency fallback, apply unapplied migrations to the linked
Supabase project with:

```bash
supabase db push
```

If the project is not linked locally, run `supabase link --project-ref <project-ref>`
first, then `supabase db push`.

To refresh the optional song suggestion catalog after migrations are applied, or
after the catalog import behavior changes, run the import script with a
server-side Supabase service role key:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run song-suggestions:import
```

Use `npm run song-suggestions:import -- --dry-run` to parse and deduplicate the
catalog file without writing to Supabase.

## Analytics

PostHog setup and event rules are documented in
[docs/analytics.md](docs/analytics.md). Analytics is optional and must never
block core app behavior.

## Testing

Run the normal local checks before finishing a change:

```bash
npm run test:run
npm run build
```

Matching logic lives in `lib/matching.ts` and should be covered with focused
unit tests whenever matching behavior changes.
