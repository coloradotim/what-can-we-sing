# Analytics

Analytics are optional. If `NEXT_PUBLIC_POSTHOG_KEY` or
`NEXT_PUBLIC_POSTHOG_HOST` is missing, the app should continue to work without
tracking.

## Provider

The app initializes PostHog from `instrumentation-client.ts` using:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

Autocapture is disabled. Event capture is non-blocking and should not affect app
behavior if PostHog is unavailable.

## Privacy Contract

Do not send free-text user content to PostHog. This includes:

- feedback text
- repertoire notes
- song titles
- arranger names
- singer names
- email addresses

Analytics properties should be limited to counts, booleans, IDs, enum-like
values, and coarse app context.

## Current Events

The app currently tracks these events through `lib/analytics.ts`:

- `user_logged_in`
- `repertoire_song_added`
- `repertoire_song_edited`
- `repertoire_song_deleted`
- `quartet_started`
- `quartet_joined`
- `quartet_left`
- `quartet_member_removed`
- `quartet_matches_viewed`
- `song_marked_sung`
- `song_mark_sung_failed`
- `help_viewed`
- `feedback_submitted`

When adding an event, update this document and keep the privacy contract above
in sync with the event properties.
