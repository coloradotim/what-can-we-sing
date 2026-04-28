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

## Tables And Objects

### `profiles`

Purpose: source of truth for display names.

Code:
- Read current profile: `lib/profileStore.ts#getMyProfile`
- Read participant names by id: `lib/profileStore.ts#getProfilesByIds`
- Read profile for feedback email context: `app/api/feedback/route.ts`
- Insert/update own profile: `lib/profileStore.ts#upsertMyProfile`
- Realtime profile display-name subscription:
  `lib/profileStore.ts#subscribeToProfileDisplayNames`

Expected context:
- Browser authenticated user for reads and own upsert.
- Server route with user session for feedback profile read.

Required database contract:
- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null`
- RLS enabled.
- Authenticated users can read profiles.
- Authenticated users can insert/update only their own profile where
  `id = auth.uid()`.
- Table is in the Supabase Realtime publication.

Established by migrations:
- `20260428060000_supabase_contract_alignment.sql`

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

Established by migrations:
- `20260428060000_supabase_contract_alignment.sql`
- `20260428142000_add_part_confidences_to_repertoire.sql`
- `20260428145000_add_repertoire_sung_metadata.sql`

### `sessions`

Purpose: source of truth for quartet join codes and session activity.

Code:
- Insert new session: `lib/sessionStore.ts#createSession`
- Read by join code: `lib/sessionStore.ts#getSessionByCode`
- Update `last_activity_at`: internal helper in `lib/sessionStore.ts`, called
  after participant snapshot upserts.

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
- Remove selected row by id: `lib/sessionStore.ts#removeParticipantById`
- Realtime participant subscription:
  `lib/sessionStore.ts#subscribeToSessionParticipants`
- Repertoire snapshot refresh:
  `lib/activeQuartetSnapshot.ts#refreshActiveQuartetSnapshot`
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
- Table is in the Supabase Realtime publication.

Established by migrations:
- `20260428051000_fix_session_participants_rls.sql`
- `20260428060000_supabase_contract_alignment.sql`

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

- Users sign in with Supabase Auth OTP from `app/login/page.tsx`.
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
- Participant realtime payload application in
  `lib/__tests__/sessionParticipantChanges.test.ts`
- Existing participant/rejoin recognition by `user_id` in
  `lib/__tests__/sessionParticipantResolution.test.ts`
- Display names derived from `profiles` instead of stale participant names in
  `lib/__tests__/sessionParticipantDisplayName.test.ts`
- Active quartet local-storage behavior in `lib/__tests__/activeQuartet.test.ts`
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
