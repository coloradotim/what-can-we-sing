# Analytics

Analytics are optional. If `NEXT_PUBLIC_POSTHOG_KEY` or
`NEXT_PUBLIC_POSTHOG_HOST` is missing, the app continues to work without
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
- quartet join codes

Analytics properties should be limited to counts, booleans, IDs, enum-like
values, and coarse app context. `lib/analytics.ts` drops properties whose keys
look like free-text or identifying fields before sending events.

Route analytics use `app_route_viewed` with a normalized `route` property.
Dynamic quartet links are reported as `/join/[code]`, not the actual code.

## Event Audit

The app currently tracks these events through `lib/analytics.ts`:

| Event | Fires from | Properties | PII? | Dashboard usage |
| --- | --- | --- | --- | --- |
| `app_route_viewed` | `components/AnalyticsIdentity.tsx` on route changes | `route` | No; join codes are normalized | Product Health, Quartet Funnel |
| `user_logged_in` | `components/AnalyticsIdentity.tsx` once per browser session after auth is restored | none | No | Product Health, Quartet Funnel |
| `quartet_created` | `app/session/page.tsx` after a new session and participant row are created | `session_id`, `participant_count`, `song_count` | No free text | Product Health |
| `quartet_started` | `app/session/page.tsx` after a new session and participant row are created | `session_id`, `participant_count`, `song_count` | No free text | Legacy compatibility |
| `quartet_join_attempted` | `app/join/[code]/page.tsx` before attempting to add or refresh a participant row | `session_id` | No free text | Quartet Funnel, Browser / Mobile Compatibility |
| `quartet_joined` | `app/session/page.tsx` and `app/join/[code]/page.tsx` after a participant row exists | `session_id`, `participant_count`, `song_count` | No free text | Product Health, Quartet Funnel, Browser / Mobile Compatibility |
| `quartet_join_failed` | `app/join/[code]/page.tsx` when joining is blocked or the write fails | `session_id`, `reason`, `participant_count` | No free text | Reliability / Errors |
| `quartet_rejoined` | `app/join/[code]/page.tsx` when an existing participant refreshes their snapshot | `session_id`, `participant_count`, `song_count` | No free text | Product Health, Repertoire & Matching |
| `quartet_full` | `app/join/[code]/page.tsx` when participant count reaches four | `session_id`, `participant_count` | No free text | Product Health, Quartet Funnel |
| `quartet_leave_clicked` | Quartet page, active-quartet nav, start page, and manual join flow before leave confirmation/write | `session_id`, `source` | No free text | Browser / Mobile Compatibility |
| `quartet_leave_confirmed` | Quartet page, active-quartet nav, start page, and manual join flow before deleting membership | `session_id`, `source` | No free text | Browser / Mobile Compatibility |
| `quartet_left` | Quartet page, active-quartet nav, start page, and manual join flow after membership delete succeeds | `session_id`, `participant_count` | No free text | Product Health, Browser / Mobile Compatibility |
| `quartet_leave_failed` | Quartet page, active-quartet nav, start page, and manual join flow when leave delete fails | `session_id`, `source` | No free text | Reliability / Errors, Browser / Mobile Compatibility |
| `quartet_member_removed` | `app/join/[code]/page.tsx` after one singer removes another | `session_id`, `participant_count` | No free text | Browser / Mobile Compatibility |
| `quartet_matches_viewed` | `app/join/[code]/page.tsx` when match counts change | `session_id`, `participant_count`, match counts | No free text | Legacy compatibility |
| `matches_generated` | `app/join/[code]/page.tsx` when match counts change | `session_id`, `participant_count`, match counts | No free text | Quartet Funnel, Repertoire & Matching |
| `zero_matches_found` | `app/join/[code]/page.tsx` when a full quartet has no matches | `session_id`, `participant_count` | No free text | Repertoire & Matching |
| `repertoire_song_added` | `components/RepertoireManager.tsx` after adding a song | `song_count`, `parts_known_count` | No free text | Legacy compatibility |
| `repertoire_song_edited` | `components/RepertoireManager.tsx` after editing a song | `song_count`, `parts_known_count` | No free text | Legacy compatibility |
| `repertoire_song_deleted` | `components/RepertoireManager.tsx` after deleting a song | `song_count` | No free text | Legacy compatibility |
| `repertoire_updated` | `components/RepertoireManager.tsx` after add/edit/delete succeeds | `action`, `song_count`, `parts_known_count` | No free text | Quartet Funnel, Repertoire & Matching |
| `repertoire_update_failed` | `components/RepertoireManager.tsx` when add/edit/delete fails | `action` | No free text | Reliability / Errors |
| `song_marked_sung` | `app/join/[code]/page.tsx` after marking a match as sung | `session_id`, `match_category`, `voicing` | No free text | Future recently sung dashboard |
| `song_mark_sung_failed` | `app/join/[code]/page.tsx` when marking a match as sung fails | `session_id`, `match_category`, `voicing` | No free text | Reliability / Errors |
| `help_viewed` | `app/help/page.tsx` when the help page loads | none | No | Product Health context |
| `feedback_submitted` | `app/help/page.tsx` after feedback API succeeds | `category`, `length` | No message text | Product Health |
| `feedback_failed` | `app/help/page.tsx` when feedback API fails | `category`, `status_code` or `reason` | No message text | Reliability / Errors |

## Reproducible Dashboards

Dashboard definitions live in `analytics/posthog/dashboards.json`. They cover:

- Product Health
- Quartet Funnel
- Repertoire & Matching
- Reliability / Errors
- Browser / Mobile Compatibility

Validate the dashboard spec locally with:

```sh
npm run posthog:dashboards:check
```

Sync dashboards to PostHog with:

```sh
POSTHOG_PERSONAL_API_KEY=phx_... \
POSTHOG_HOST=https://us.posthog.com \
POSTHOG_ENVIRONMENT_ID=... \
npm run posthog:dashboards:sync
```

`POSTHOG_PROJECT_ID` is accepted as a fallback name for older PostHog docs, but
`POSTHOG_ENVIRONMENT_ID` matches the current PostHog dashboard and insight API
paths.

The sync script is idempotent by dashboard and insight name:

- existing dashboards are patched by exact name
- existing insights are patched by exact name
- missing dashboards and insights are created
- insights are created with PostHog query objects rather than legacy insight
  filters
- API keys are read from environment variables only

The personal API key needs PostHog dashboard and insight read/write scopes.

## Known Gaps

- The app does not currently track auth-link delivery or Supabase server-side
  auth errors because those happen outside the browser analytics layer.
- The app does not track raw song titles, arranger names, feedback text, or
  display names by design.
- If dashboard sync fails because PostHog changes an insight filter shape, keep
  `analytics/posthog/dashboards.json` as the source of truth and update
  `scripts/posthog/sync-dashboards.mjs` rather than creating dashboards by hand.

When adding an event, update this document, keep
`analytics/posthog/dashboards.json` in sync if a dashboard should use it, and
preserve the privacy contract above.
