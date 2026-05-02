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
- My Songs add, edit, delete, and mark-as-sung actions update
  `user_repertoire`. Add/edit/delete actions refresh the active quartet
  `session_participants.repertoire` snapshot when the user is in a quartet.
- Private My Songs sharing is opt-in. A singer creates a code in
  `repertoire_shares`; recipients can view only safe song identity fields
  through `get_shared_repertoire` and must sign in before copying songs into
  their own `user_repertoire`.
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
- Dismiss repertoire quartet nudge:
  `lib/profileStore.ts#dismissQuartetNudge`
- Realtime profile display-name subscription:
  `lib/profileStore.ts#subscribeToProfileDisplayNames`
- Admin deletion:
  `scripts/delete-user.mjs` deletes the user's `profiles` row with the
  Supabase service-role key during confirmed account deletion.

Expected context:
- Browser authenticated user for reads and own upsert.
- Server route with user session for feedback profile read.
- Local/server admin script with `SUPABASE_SERVICE_ROLE_KEY` for account
  deletion only.

Required database contract:
- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null`
- `has_seen_welcome boolean not null default false`
- `has_dismissed_quartet_nudge boolean not null default false`
- RLS enabled.
- Authenticated users can read profiles.
- Authenticated users can insert/update only their own profile where
  `id = auth.uid()`.
- Table is in the Supabase Realtime publication.

Established by migrations:
- `20260428060000_supabase_contract_alignment.sql`
- `20260501133000_add_profile_welcome_seen.sql`
- `20260501154500_add_quartet_nudge_dismissal.sql`

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
- Deleted by `scripts/delete-user.mjs` during confirmed account deletion.

Expected context:
- Browser authenticated user.
- Local/server admin script with `SUPABASE_SERVICE_ROLE_KEY` for account
  deletion only.

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
- `public.mark_repertoire_sung(p_repertoire_id uuid, p_session_id uuid default null)`
  updates only the authenticated user's matching `user_repertoire` row,
  increments `times_sung_count`, sets `last_sung_at`, and records the matching
  private `sung_song_events` row in one database operation. Quartet-page marks
  pass a session id; My Songs marks pass `null`.
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

### `repertoire_shares`

Purpose: opt-in private My Songs copy links. A copy code lets another
singer view only song identity fields from the owner's current My Songs entries
so they can copy selected songs into their own My Songs.

Code:
- Create active copy link/code: `lib/repertoireSharing.ts#createRepertoireShare`
- Read own active copy link/code:
  `lib/repertoireSharing.ts#getMyActiveRepertoireShare`
- Revoke own copy link/code: `lib/repertoireSharing.ts#revokeRepertoireShare`
- Read safe shared repertoire by code:
  `lib/repertoireSharing.ts#getSharedRepertoire`, through
  `public.get_shared_repertoire`
- Recipient copy flow: `components/SharedRepertoireManager.tsx`
- "Let another singer copy songs from My Songs" controls:
  `components/RepertoireManager.tsx`

Expected context:
- Browser authenticated owner for create/read/revoke of own share rows.
- Anonymous or authenticated browser user for `get_shared_repertoire` by code.
- Authenticated browser user for copying selected songs into their own
  `user_repertoire`.

Required database contract:
- `id uuid primary key`
- `owner_id uuid not null references auth.users(id) on delete cascade`
- `code text not null` with six uppercase alphanumeric characters
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz`
- `expires_at timestamptz`
- Unique index on `code`
- RLS enabled.
- Authenticated users can select/insert/update only their own share rows where
  `owner_id = auth.uid()`.
- `public.get_shared_repertoire(p_code text)` is a security-definer RPC
  available to `anon` and `authenticated`. It returns only active,
  non-expired shares and only these fields: `share_id`, `code`,
  `owner_display_name`, `song_id`, `song_title`, `voicing`, and
  `arranger_name`.
- The shared view must not expose owner email, user IDs, notes, parts,
  confidence, last-sung history, timestamps, or quartet/session history.
- Revoked or expired links return no rows.

Established by migrations:
- `20260501190000_add_repertoire_shares.sql`

### `song_suggestion_catalog`

Purpose: optional autocomplete reference data for song entry, imported from
`data/song_suggestion_catalog.psv`. The PSV catalog is maintained from
controlled metadata sources under `data/sources/`; see
`docs/song-sources.md`.

Code:
- Imported by `scripts/import-song-suggestions.mjs`
- BHS source data is transformed by `scripts/song-sources/import-bhs-catalog.mjs`
  into `data/sources/bhs_song_catalog_suggestions.psv`
- Barbershop Connections source data is scraped by
  `scripts/song-sources/scrape-barbershop-connections.mjs` into
  `data/sources/barbershop_connections_song_suggestions.psv`
- BarbershopTracks source data is scraped from rendered Playwright pages by
  `scripts/song-sources/scrape-barbershoptracks.mjs` into
  `data/sources/barbershoptracks_song_suggestions.psv`
- TimTracks source data is scraped from the public DataTables endpoint by
  `scripts/song-sources/scrape-timtracks.mjs` into
  `data/sources/timtracks_song_suggestions.psv`
- Harmony Brigade source data is transformed by
  `scripts/song-sources/import-harmony-brigade-db.mjs` into
  `data/sources/harmony_brigade_song_suggestions.psv`
- `scripts/merge-song-suggestion-sources.mjs` safely merges committed source
  PSVs into `data/song_suggestion_catalog.psv` with a timestamped local backup
- Preserved by `scripts/delete-user.mjs`; catalog rows are global suggestions,
  not user-owned data.
- Read only through `public.search_repertoire_song_suggestions`
- Parsed/deduplicated by `lib/__tests__/songSuggestionCatalogImport.test.ts`
  and import-source tests including
  `lib/__tests__/songSourcePipeline.test.mjs` and
  `lib/__tests__/barbershoptracksParser.test.mjs`

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
- The BHS transform also splits clearly multi-voicing product rows into one row
  per supported voicing and skips ambiguous, unsupported, non-four-part, or
  collection products.
- The International Songs transform parses `Title`, `Arranger`, and `Voicing`
  only, splits clearly multi-voicing rows into one row per supported voicing,
  and skips missing, unsupported, or ambiguous voicing values.
- Product descriptions are used only as import signal for voicing and arranger
  parsing; full descriptions are not stored in the suggestion catalog.
- Catalog rows are suggestions only and must never be inserted into
  `user_repertoire` unless a user explicitly saves a repertoire item

Established by migrations:
- `20260429060000_add_song_suggestion_catalog.sql`
- `20260429162000_limit_song_suggestions_to_supported_voicings.sql`

### Harmony Brigade Reference Tables

Purpose: read-only reference data for the **Add Harmony Brigade songs** flow.
The data is exported from Ross Wilkins' read-only MySQL history database into
repo-managed CSV snapshots under `data/harmony-brigade/`, then imported into
Supabase with `scripts/import-harmony-brigade-songs.mjs`.

Code:
- Export source snapshots: `scripts/export-harmony-brigade-source.mjs`
- Import snapshots: `scripts/import-harmony-brigade-songs.mjs`
- Browser reads reference rows through `lib/harmonyBrigade.ts`
- Repertoire UI: `components/RepertoireManager.tsx`
- Tests: `lib/__tests__/harmonyBrigade.test.ts`,
  `lib/__tests__/harmonyBrigadeImport.test.mjs`, and
  `lib/__tests__/harmonyBrigadeUi.test.ts`

Expected context:
- Local/admin export script connects to Ross's read-only MySQL source.
- Server/local import script writes with `SUPABASE_SERVICE_ROLE_KEY`.
- Browser authenticated users have read-only access to Supabase Harmony Brigade
  reference rows.
- Browser users never write to these reference tables. Adding songs writes only
  to the current user's `user_repertoire`.
- The UI lists event-song appearances from `harmony_brigade_event_songs`, not
  only unique songs. If a user selects parts from multiple appearances of the
  same normalized song + arranger, the app writes one `user_repertoire` row with
  combined TTBB part confidences.
- The picker groups visible cards by normalized title + `TTBB` + normalized
  arranger while preserving an appearances list for year/brigade/track context.
  Blank arranger and literal `Unknown` remain different identities.
- The UI scopes event-song reads by the selected year/brigade event ids and
  paginates Supabase reads. It must not depend on one unbounded
  `harmony_brigade_event_songs` select and then filter a potentially capped
  result set in the browser.
- The import script prints per-event song counts before writing, and after
  writing when not in dry-run mode. Counts below 10 are flagged as suspicious
  data-quality warnings, not hard failures, because some historical/special
  events may legitimately have shorter lists.

Required database contract:
- `harmony_brigade_songs`
  - `id uuid primary key`
  - `source_song_id integer not null unique`
  - `song_title text not null`
  - `normalized_title text not null`
  - `arranger text`
  - `normalized_arranger text`
  - `default_voicing text not null default 'TTBB'`
  - optional metadata: `song_key`, `starting_words`, `as_sung_by`,
    `learning_track_provider`, `song_style`, `song_length`, `difficulty`,
    `genre`, `tempo`
  - Check constraint keeps `default_voicing = 'TTBB'`
- `harmony_brigade_events`
  - `id uuid primary key`
  - `year_held integer not null`
  - `brigade_abbr text not null`
  - `brigade_name text`
  - `event_label text not null`
  - Unique index on `(year_held, brigade_abbr)`
- `harmony_brigade_event_songs`
  - `id uuid primary key`
  - `event_id uuid references harmony_brigade_events(id) on delete cascade`
  - `song_id uuid references harmony_brigade_songs(id) on delete cascade`
  - optional `track_number` and `sort_order`
  - Unique index on `(event_id, song_id)`
- RLS enabled on all three tables.
- Authenticated users can select reference rows.
- No authenticated insert/update/delete policies are granted for reference
  tables.

Established by migrations:
- `20260501200000_add_harmony_brigade_reference_tables.sql`

### Event Mode Events

Purpose: source of truth for user-created Event Mode event spaces. Event Mode
helps signed-in singers find the right convention, afterglow, Brigade weekend,
chapter event, retreat, or informal singing event without requiring an
admin-created listing or a private quartet code.

Event Mode is temporary, opt-in, event-scoped, and a bridge back to the
existing Start/Join quartet flow. It must not become GPS tracking, exact
location discovery, a global singer directory, permanent availability,
repertoire sharing, a public profile system, or a formal invite-to-quartet
workflow.

Code:
- Browser create/search/edit/close and availability helpers:
  `lib/eventMode.ts`
- Event Mode landing/search/create route: `app/event-mode/page.tsx`
- Event detail/code route: `app/event-mode/[code]/page.tsx`
- Tests: `lib/__tests__/eventMode.test.ts`,
  `lib/__tests__/eventModeUi.test.ts`, and this Supabase contract test

Expected context:
- Signed-in users can create listed or unlisted events.
- Signed-in users can browse/search listed upcoming or active events.
- Unlisted events are not returned by listed browse/search helpers.
- Anyone with a valid event code or link can open the event route through
  `get_event_mode_event_by_code`.
- Event creators can edit event name, date/time, location note, and visibility.
- Event creators can close their own event by setting `closed_at`.
- Other users cannot edit or close events they did not create.
- Lifecycle is derived from `start_at`, `end_at`, and `closed_at` as upcoming,
  active, or ended.
- Duplicate prevention is an app helper that compares normalized name, date
  overlap, and location context before final create.

Required database contract:
- `event_mode_events`
  - `id uuid primary key`
  - `name text not null`
  - `normalized_name text not null`
  - optional `city text`
  - optional `venue_or_location_note text`
  - `start_at timestamptz not null`
  - `end_at timestamptz not null`
  - `visibility text not null default 'listed'`
  - `join_code text not null`
  - `created_by_user_id uuid references auth.users(id)`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - optional `closed_at timestamptz`
- Check constraint keeps `end_at > start_at`.
- Check constraint keeps visibility to `listed` or `unlisted`.
- Check constraint keeps join codes to six uppercase alphanumeric characters.
- Unique index on `join_code`.
- Browse index on visibility and event dates for open events.
- Creator index on `created_by_user_id`.
- RLS enabled.
- Authenticated users can select listed events and their own events.
- Authenticated users can insert rows only with
  `created_by_user_id = auth.uid()`.
- Event creators can update only their own rows.
- No authenticated delete policy; closing an event updates `closed_at`.
- `get_event_mode_event_by_code(text)` is a security-definer function granted
  to anon and authenticated users so unlisted events can be opened by link/code
  without appearing in browse/search.

Established by migrations:
- `20260502080000_add_event_mode_events.sql`

### Event Mode Availability

Purpose: temporary, opt-in, event-scoped singer availability for Event Mode.
It helps singers at the same event see who is open to pickup singing, what
voice parts they are comfortable covering, and lightweight meet-up context.

Event Mode availability must remain separate from repertoire and quartet
matching. It must not expose repertoire, notes from My Songs, email addresses,
last-sung history, exact GPS coordinates, global availability, or a permanent
public singer profile.

Code:
- Read active availability for an event code:
  `lib/eventMode.ts#getEventModeAvailabilityByCode`, through
  `public.get_event_mode_availability_by_code`
- Create/update the current user's availability:
  `lib/eventMode.ts#upsertEventModeAvailability`
- Turn off the current user's availability:
  `lib/eventMode.ts#turnOffEventModeAvailability`
- Event detail UI: `app/event-mode/[code]/page.tsx`
- Tests: `lib/__tests__/eventMode.test.ts`,
  `lib/__tests__/eventModeUi.test.ts`, and this Supabase contract test

Expected context:
- Browser authenticated user.
- Signed-in users can mark only themselves available for an event.
- Signed-in users can update or turn off only their own availability row.
- One row is stored per `(event_id, user_id)`. Updating availability upserts
  that row and clears `turned_off_at`.
- Availability is active only while `turned_off_at is null`,
  `available_until > now()`, and the event is not closed or ended.
- The event detail page reads active availability for the current event by
  link/code and filters it by voice part in the browser.
- Display names come from `profiles.display_name`; availability rows do not
  own display names.
- Voice parts are stored with unambiguous canonical voicing-prefixed labels:
  `TTBB Tenor`, `TTBB Lead`, `TTBB Baritone`, `TTBB Bass`,
  `SATB Soprano`, `SATB Alto`, `SATB Tenor`, `SATB Bass`,
  `SSAA Soprano 1`, `SSAA Soprano 2`, `SSAA Alto 1`, and `SSAA Alto 2`.
- User-facing availability displays those stored values as arrangement range
  family plus barbershop functional part, such as `Lower voice (TTBB) Lead`,
  `Mixed (SATB) Baritone`, or `Treble (SSAA) Tenor`.
- The UI may provide a Start Quartet shortcut after singers find each other,
  but Event Mode availability does not create quartet invitations.

Required database contract:
- `event_mode_availability`
  - `id uuid primary key`
  - `event_id uuid references public.event_mode_events(id) on delete cascade`
  - `user_id uuid references auth.users(id) on delete cascade`
  - `voice_parts text[] not null`
  - optional `availability_note text`
  - optional `meetup_note text`
  - `available_until timestamptz not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - optional `turned_off_at timestamptz`
- Check constraint requires at least one voice part.
- Check constraint allows only the supported Event Mode voice-part labels.
- Unique index on `(event_id, user_id)` for one active or historical row per
  singer per event.
- Active availability index on `(event_id, available_until)` where
  `turned_off_at is null`.
- RLS enabled.
- Authenticated users can read their own rows.
- Authenticated users can read other active rows for listed, open events.
- Authenticated users can insert/update only rows where `user_id = auth.uid()`.
- `public.get_event_mode_availability_by_code(text)` is a security-definer
  function granted only to authenticated users. It returns active rows for the
  event code, joins `profiles.display_name`, and must not return email,
  repertoire, user notes, quartet membership, or song history.
- No authenticated delete policy; turning availability off updates
  `turned_off_at`.

Established by migrations:
- `20260502100000_add_event_mode_availability.sql`

### `sessions`

Purpose: source of truth for quartet join codes and session activity.

Code:
- Insert new session: `lib/sessionStore.ts#createSession`
- Read by join code: `lib/sessionStore.ts#getSessionByCode`
- Update `last_activity_at`: internal helper in `lib/sessionStore.ts`, called
  after participant snapshot upserts.
- Start quartet flow: `app/session/page.tsx` creates the session before
  inserting the first participant snapshot.
- Preserved by `scripts/delete-user.mjs`; sessions are shared join-code records.

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
- Deleted by `scripts/delete-user.mjs` during confirmed account deletion.

Expected context:
- Browser authenticated user.
- Local/server admin script with `SUPABASE_SERVICE_ROLE_KEY` for account
  deletion only.

Required database contract:
- `id uuid primary key`
- `session_id uuid references public.sessions(id) on delete cascade`; nullable
  for songs marked from My Songs outside a quartet.
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
- Deleted by `scripts/delete-user.mjs` during confirmed account deletion.

Expected context:
- Browser authenticated user.
- Local/server admin script with `SUPABASE_SERVICE_ROLE_KEY` for account
  deletion only.

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
- `20260501210000_allow_repertoire_mark_sung_without_session.sql`

### Feedback Email

Purpose: send user feedback email through Resend.

Supabase usage:
- `app/api/feedback/route.ts` calls `supabase.auth.getUser()`.
- If a user is authenticated, it reads `profiles.display_name`.
- No feedback table, RPC, storage bucket, or Supabase function is used.
- `scripts/delete-user.mjs` therefore has no Supabase feedback rows to delete;
  delivered email and provider logs are outside the database.

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
- Account deletion uses `scripts/delete-user.mjs` from a trusted local/server
  environment with `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never
  be exposed to browser code. The script defaults to dry-run mode, requires an
  exact email or auth user ID, and requires `--confirm-production` in addition
  to `--confirm` when `WCWS_ADMIN_ENV=production` or `VERCEL_ENV=production`.

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
