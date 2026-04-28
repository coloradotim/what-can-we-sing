# App Flows

This document describes the current user-facing data flow. It should stay in
sync with `README.md`, `AGENTS.md`, and `docs/supabase-contract.md`.

## Source Of Truth

- `profiles.display_name` is the source of truth for singer names.
- `user_repertoire` is the source of truth for a user's saved songs, parts,
  confidence values, private notes, and recently sung metadata.
- `sessions` is the source of truth for quartet join codes and session activity.
- `session_participants` is the source of truth for active quartet membership
  and each singer's repertoire snapshot.
- Local active-quartet state is only a navigation shortcut. The quartet screen
  must reconcile it against `session_participants`.

## Quartet Lifecycle

### Start Quartet

Starting a quartet creates a `sessions` row, reads the current user's profile
and repertoire, writes that user's `session_participants` snapshot, stores the
active quartet shortcut locally, and then sends the user to `/join/[code]`.

The first singer should appear in the quartet without needing to manually join
again.

### Join Quartet

Joining by `/join/[code]` reads the session by join code and fetches current
`session_participants` rows from Supabase. Existing participants are recognized
by `user_id`, not by display name.

New participants can join until the quartet has four singers. The four-singer
limit is enforced before inserting another `session_participants` row.

### Rejoin Quartet

Returning to `/join/[code]` as an existing participant should not insert a
duplicate row. The page should use the existing row and the latest database
state.

If a user previously left or was removed from the quartet, they should not be
silently re-added just because local active-quartet state still exists.

### Leave Quartet

Leaving a quartet deletes the current user's `session_participants` row. Other
clients should update from Realtime or from the next explicit refetch.

### Remove Singer

A current participant may remove another singer through
`remove_session_participant_by_id`. The removed singer's
`session_participants` row is deleted, and their client should stop treating the
quartet as active after it observes that database state.

### Repertoire Updates While In A Quartet

Adding, editing, or deleting repertoire updates `user_repertoire`. If the user
has an active quartet, the app refreshes that user's
`session_participants.repertoire` snapshot so quartet results derive from the
database snapshot instead of stale local component state.

## Matching

Matching uses the current `session_participants` rows. A valid quartet match
requires distinct singers assigned to distinct required parts for the song's
voicing. Title matching is forgiving enough to catch close variants, but
different voicings are not combined.

Arranger differences or missing arranger values do not block a match. They are
shown as confirmation warnings so singers can decide quickly in the room.

## Navigation

The home page is an action hub. It offers Start Quartet, Join Quartet, Return to
Quartet when local state exists, and Repertoire. Manual code entry belongs on
`/join`, while QR and shared links use `/join/[code]`. Help and feedback live at
`/help`; `/feedback` redirects there for older links.

## Auth

The app uses Supabase Auth email one-time codes. Login and first-time signup
emails should use the template in `docs/auth-email-template.md`; the app does
not rely on magic-link callback redirects.

## Analytics

PostHog is optional and controlled by `NEXT_PUBLIC_POSTHOG_KEY` and
`NEXT_PUBLIC_POSTHOG_HOST`. Events must not include free-text user content such
as feedback text, repertoire notes, song titles, arranger names, singer names,
or email addresses.

See `docs/analytics.md` for the current event contract.
