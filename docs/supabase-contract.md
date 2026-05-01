# Supabase Contract

This document is the source of truth for how the app uses Supabase. Any code
change that adds or changes a Supabase operation must update this contract, the
migrations in `supabase/migrations`, and tests or test documentation.

## Client Model

- Browser code uses `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Browser writes run as the authenticated user. Service-role keys must never be
  used in browser code.
- Feedback email delivery runs on the server through the `/api/feedback` route.
  It uses Supabase Auth only to identify the current user and read their profile.
- Realtime is required for `profiles` and `session_participants`.

## App Flow Contract

- Starting a quartet creates a `sessions` row and immediately inserts the
  current user's `session_participants` snapshot before navigating to
  `/join/[code]`.
- `/join/[code]` reads fresh session and participant data from Supabase on load.
  Existing participants are recognized by `user_id`, not by display name.
- Local active-quartet state is a shortcut for navigation only. It must not be
  treated as proof that the user still has a current `session_participants` row.
- Repertoire add, edit, delete, and mark-as-sung actions update
  `user_repertoire`. Add/edit/delete actions refresh the active quartet
  `session_participants.repertoire` snapshot when the user is in a quartet.
- Leaving a quartet deletes the current user's `session_participants` row.
- Removing another singer uses `remove_session_participant_by_id` and deletes
  the selected participant row when the requester is also a current participant
  in that session.
- Quartet participant lists and match results derive from the latest
  `session_participants` rows plus profile display names.

## Tables And Objects

### `profiles`

Purpose: source of truth for display names and lightweight first-run user
preferences.

Code:
- Read current profile: `lib/profileStore.ts#getMyProfile`
- Read participant names by id: `lib/profileStore.ts#getProfilesByIds`
- Read profile for feedback email context: `app/api/feedback/route.ts`
- Insert/update own profile: `lib/profileStore.ts#upsertMyProfile`
- Mark quick-start orientation as seen: `lib/profileStore.ts#markWelcomeSeen`
- Realtime profile display-name subscription:
  `lib/profileStore.ts#subscribeToProfileDisplayNames`

Expected context:
- Browser authenticated user for reads and own upsert.
- Server route with user session for feedback profile read.

Required database contract:
- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null`
- `has_seen_welcome boolean not null default false`
- RLS enabled.
- Authenticated users can read profiles.
- Authenticated users can insert/update only their own profile where
  `id = auth.uid()`.
- Table is in the Supabase Realtime publication.

Established by migrations:
- `20260428060000_supabase_contract_alignment.sql`
- `20260501133000_add_profile_welcome_seen.sql`

### `user_repertoire`

Purpose: source of truth for each user's saved songs.

Code:
- Read own repertoire: `lib/repertoireStore.ts#getMyRepertoire`
- Insert own song: `lib/repertoireStore.ts#addRepertoireItem`
- Update own song: `lib/repertoireStore.ts#updateRepertoireItem`
- Delete own song: `lib/repertoireStore.ts#deleteRepertoireItem`
- Mark own song as sung:
  `lib/repertoireStore.ts#markRepertoireItemAsSung`, through
  `public.mark_repertoire_sung`
- Search global song identity suggestions:
  `lib/repertoireStore.ts#searchRepertoireSongSuggestions`, through
  `public.search_repertoire_song_suggestions`
- Used by `lib/activeQuartetSnapshot.ts` to refresh the current user's
  `session_participants.repertoire` snapshot.

Expected context:
- Browser authenticated user.

Required database contract:
- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `song_title text not null`
- `voicing text not null`
- `arranger_name text`
- `parts_known text[] not null`
- `part_confidences jsonb not null default '[]'::jsonb`
- `confidence text` remains for legacy rows and compatibility; new code stores
  per-part confidence in `part_confidences` and keeps this set to the first
  row's confidence.
- `notes text`
- `last_sung_at timestamptz`
- `times_sung_count integer not null default 0`
- RLS enabled.
- Authenticated users can select/insert/update/delete only rows where
  `user_id = auth.uid()`.
- Index on `(user_id, song_title)` for repertoire listing.
- Index on `(user_id, last_sung_at desc)` for future sung-history sorting.
- `public.mark_repertoire_sung(p_repertoire_id uuid, p_session_id uuid)`
  updates only the authenticated user's matching `user_repertoire` row,
  increments `times_sung_count`, sets `last_sung_at`, and records the matching
  private `sung_song_events` row in one database operation.
- `public.search_repertoire_song_suggestions(p_query text, p_limit integer)`
  is a security-definer RPC available only to authenticated users. It returns
  distinct global song identity suggestions from all repertoire rows and
  reference rows from `song_suggestion_catalog`: `song_title`, `voicing`, and
  `arranger_name`. It must not return `user_id`, singer names, notes, parts,
  confidence, timestamps, or other per-user repertoire details. Blank
  `arranger_name` values remain `null`/blank in app display and are distinct
  from a literal entered value such as `Unknown`. It returns only supported
  single voicing values: `TTBB`, `SATB`, and `SSAA`.

Established by migrations:
- `20260428060000_supabase_contract_alignment.sql`
- `20260428142000_add_part_confidences_to_repertoire.sql`
- `20260428145000_add_repertoire_sung_metadata.sql`
- `20260428223000_add_global_song_suggestions.sql`

### `song_suggestion_catalog`

Purpose: optional autocomplete reference data for song entry, imported from
`data/song_suggestion_catalog.psv`.

Code:
- Imported by `scripts/import-song-suggestions.mjs`
- Read only through `public.search_repertoire_song_suggestions`
- Parsed/deduplicated by `lib/__tests__/songSuggestionCatalogImport.test.ts`

Expected context:
- Server/local import script with `SUPABASE_SERVICE_ROLE_KEY`
- Browser authenticated users through the security-definer suggestion RPC only

Required database contract:
- `id uuid primary key`
- `title text not null`
- `normalized_title text not null`
- `voicing text not null`
- `arranger text`
- `normalized_arranger text`
- `source text not null default 'Barbershop Connections'`
- `created_at timestamptz not null default now()`
- Unique index on `(normalized_title, voicing, coalesce(normalized_arranger, ''))`
- Index on `normalized_title`
- Trigram index on `title`
- Supported voicings are `TTBB`, `SATB`, and `SSAA`
- RLS enabled; no direct browser table access is required
- Import expands comma-separated source voicings into one row per supported
  voicing and ignores unsupported voicing values
- Catalog rows are suggestions only and must never be inserted into
  `user_repertoire` unless a user explicitly saves a repertoire item

Established by migrations:
- `20260429060000_add_song_suggestion_catalog.sql`
- `20260429162000_limit_song_suggestions_to_supported_voicings.sql`

### `sessions`

Purpose: source of truth for quartet join codes and session activity.

Code:
- Insert new session: `lib/sessionStore.ts#createSession`
- Read by join code: `lib/sessionStore.ts#getSessionByCode`
- Update `last_activity_at`: internal helper in `lib/sessionStore.ts`, called
  after participant snapshot upserts.
- Start quartet flow: `app/session/page.tsx` creates the session before
  inserting the first participant snapshot.

Expected context:
- Browser authenticated user.

Required database contract:
- `id uuid primary key`
- `join_code text not null`
- `created_at timestamptz not null default now()`
- `last_activity_at timestamptz`
- Unique index on `join_code`.
- RLS enabled.
- Authenticated users can select sessions, create sessions, and update session
  activity.

Established by migrations:
- `20260428060000_supabase_contract_alignment.sql`

### `session_participants`

Purpose: source of truth for active quartet membership and each participant's
repertoire snapshot. Quartet participant lists and match results must derive
from this table, not local-only state.

Code:
- Read participants: `lib/sessionStore.ts#getParticipants`
- Insert/update own snapshot: `lib/sessionStore.ts#upsertParticipant`
- Delete own row: `lib/sessionStore.ts#removeParticipant`
- Remove selected row by id: `lib/sessionStore.ts#removeParticipantById`,
  through `public.remove_session_participant_by_id`
- Realtime participant subscription:
  `lib/sessionStore.ts#subscribeToSessionParticipants`
- Repertoire snapshot refresh:
  `lib/activeQuartetSnapshot.ts#refreshActiveQuartetSnapshot`
- Participant display data:
  `lib/participantEntries.ts` combines participant membership with
  `profiles.display_name`
- Match calculation source:
  `app/join/[code]/page.tsx` builds entries from current participants and calls
  `findMatches`.

Expected context:
- Browser authenticated user.

Required database contract:
- `id uuid primary key`
- `session_id uuid not null references public.sessions(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `display_name text not null`
- `repertoire jsonb not null default '[]'::jsonb`; snapshot entries include
  `partsKnown` and, for current snapshots, `partConfidences`
- `joined_at timestamptz not null default now()`
- Unique index on `(session_id, user_id)` for upserts.
- RLS enabled.
- Authenticated users can select session participants.
- Authenticated users can insert/update/delete only their own row where
  `user_id = auth.uid()`.
- Authenticated users who are current participants in a session can call
  `public.remove_session_participant_by_id(p_session_id, p_participant_id)` to
  remove another participant from that same session.
- Table is in the Supabase Realtime publication.

Established by migrations:
- `20260428051000_fix_session_participants_rls.sql`
- `20260428060000_supabase_contract_alignment.sql`
- `20260428151000_add_participant_removal_function.sql`

### `sung_song_events`

Purpose: private per-user log for songs marked as recently sung.

Code:
- Read recent events: `lib/sungSongStore.ts#getRecentSungSongs`
- Insert event as part of marking repertoire metadata:
  `public.mark_repertoire_sung`

Expected context:
- Browser authenticated user.

Required database contract:
- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `session_id uuid not null references public.sessions(id) on delete cascade`
- `song_title text not null`
- `voicing text not null`
- `arranger_name text`
- `sung_at timestamptz not null default now()`
- RLS enabled.
- Authenticated users can select/insert only rows where
  `user_id = auth.uid()`.
- Index on `(user_id, sung_at desc)`.

Established by migrations:
- `20260428060000_supabase_contract_alignment.sql`

### Feedback Email

Purpose: send user feedback email through Resend.

Supabase usage:
- `app/api/feedback/route.ts` calls `supabase.auth.getUser()`.
- If a user is authenticated, it reads `profiles.display_name`.
- No feedback table, RPC, storage bucket, or Supabase function is used.

Expected context:
- Server route with user cookies.
- Resend credentials are server-only environment variables.

## Auth Assumptions

- Users sign in with Supabase Auth email OTP from `app/login/page.tsx`.
- The app verifies typed codes with Supabase and does not rely on magic-link
  callback redirects.
- Most app pages require an authenticated user before reading or writing app
  tables.
- RLS policies are written for the `authenticated` role and `auth.uid()`.

## Realtime Assumptions

- `profiles` must be in the Supabase Realtime publication for live display-name
  updates.
- `session_participants` must be in the Supabase Realtime publication for live
  join, leave, and snapshot updates.
- The quartet screen also refetches `session_participants`, so the database is
  the source of truth even if a realtime event is missed.

## Coverage

Automated tests currently cover:
- Matching rules and ranking in `lib/__tests__/matching.test.ts`
- Title normalization and suggested matches in
  `lib/__tests__/matching.test.ts`
- Participant entry derivation from profile names in
  `lib/__tests__/participantEntries.test.ts`
- Participant realtime payload application in
  `lib/__tests__/sessionParticipantChanges.test.ts`
- Existing participant/rejoin recognition by `user_id` in
  `lib/__tests__/sessionParticipantResolution.test.ts`
- Display names derived from `profiles` instead of stale participant names in
  `lib/__tests__/sessionParticipantDisplayName.test.ts`
- Active quartet local-storage behavior in `lib/__tests__/activeQuartet.test.ts`
- Active quartet snapshot refresh behavior in
  `lib/__tests__/activeQuartetSnapshot.test.ts`
- Supabase-backed participant write verification in
  `lib/__tests__/sessionStore.test.ts`
- Auth route guards and post-login redirect behavior in
  `lib/__tests__/authRoute.test.ts` and
  `lib/__tests__/authRedirect.test.ts`
- Feedback route validation and server-only destination handling in API route
  tests
- Analytics event sanitization in `lib/__tests__/analytics.test.ts`
- Quartet action confirmation controls in
  `components/QuartetActionConfirmation.test.tsx`
- Deployment automation docs/workflow guardrails in
  `lib/__tests__/deploymentAutomation.test.ts`
- Supabase contract/migration text in
  `lib/__tests__/supabaseContract.test.ts`

True RLS execution tests are not currently automated because this repo does not
start an isolated Supabase database in CI and does not have fixture auth users
for policy assertions. The smallest follow-up is to add Supabase CLI-backed
integration tests that run migrations against a local Supabase instance, create
two auth users, and assert:
- join/rejoin behavior is backed by `session_participants`
- user A can join, update their snapshot, leave, and rejoin
- user A cannot update/delete user B's participant row
- repertoire edits update only user A's `session_participants` snapshot
- quartet matches derive from refreshed `session_participants` data

## Supabase Alignment Checklist

For any PR that adds or changes a Supabase operation, update all applicable
items:

- Code path using `.from(...)`, `.rpc(...)`, Auth, Realtime, or Storage
- Migration/schema, including tables, columns, constraints, indexes, grants,
  RLS, and Realtime publication
- Tests, or a documented reason automated coverage is not practical yet
- This `docs/supabase-contract.md` file
- User-facing or operator docs for required deployment commands
