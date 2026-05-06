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
| `analytics_client_ready` | `components/AnalyticsIdentity.tsx` once per browser session when the client analytics layer mounts | none | No | Product Health |
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
| `song_marked_sung` | `app/join/[code]/page.tsx` after marking a match as sung, or `components/RepertoireManager.tsx` after marking a My Songs row as sung | `session_id`, `match_category`, `voicing`, `source` | No free text | Future recently sung dashboard |
| `song_mark_sung_failed` | `app/join/[code]/page.tsx` or `components/RepertoireManager.tsx` when marking a song as sung fails | `session_id`, `match_category`, `voicing`, `source` | No free text | Reliability / Errors |
| `help_viewed` | `app/help/page.tsx` when the help page loads | none | No | Product Health context |
| `feedback_submitted` | `app/help/page.tsx` after feedback API succeeds | `category`, `length` | No message text | Product Health |
| `feedback_failed` | `app/help/page.tsx` when feedback API fails | `category`, `status_code` or `reason` | No message text | Reliability / Errors |
| `event_mode_viewed` | `app/event-mode/page.tsx` and `app/event-mode/[code]/page.tsx` when Event Mode landing/detail pages load | `page_area`, `signed_in`, `visibility`, `lifecycle`, `availability_count`, `message_count` | No event names, codes, notes, or message text | Event Mode Beta |
| `event_mode_event_search_submitted` | `app/event-mode/page.tsx` after a user submits an Event Mode search | `result_count`, `has_search`, `status` | No raw search text | Event Mode Beta |
| `event_mode_event_created` | `app/event-mode/page.tsx` after Event Mode event creation succeeds or fails | `visibility`, `status` | No event name or location text | Event Mode Beta |
| `event_mode_event_used` | `app/event-mode/page.tsx` when a user opens an event from search, duplicate detection, or code entry | `source`, `visibility`, `lifecycle` | No event code, name, or location text | Event Mode Beta |
| `event_mode_availability_created` | `app/event-mode/[code]/page.tsx` after a user first marks themself available, or the save fails | `selected_voice_part_count`, `has_availability`, `has_meetup`, `visibility`, `lifecycle`, `status` | No availability or meetup note text | Event Mode Beta |
| `event_mode_availability_updated` | `app/event-mode/[code]/page.tsx` after an existing availability save succeeds or fails | `selected_voice_part_count`, `has_availability`, `has_meetup`, `visibility`, `lifecycle`, `status` | No availability or meetup note text | Event Mode Beta |
| `event_mode_availability_turned_off` | `app/event-mode/[code]/page.tsx` after availability is turned off, or the action fails | `visibility`, `lifecycle`, `status` | No free text | Event Mode Beta |
| `event_mode_available_singer_filter_used` | `app/event-mode/[code]/page.tsx` when the available-singer voice-part filter changes | `selected_part_count`, `availability_count`, `visibility`, `lifecycle` | No singer names or raw part labels | Event Mode Beta |
| `event_mode_message_started` | `app/event-mode/[code]/page.tsx` when a user opens the message composer for an available singer | `visibility`, `lifecycle`, `availability_count` | No display name or message text | Event Mode Beta |
| `event_mode_message_sent` | `app/event-mode/[code]/page.tsx` after a new Event Mode message succeeds or fails | `visibility`, `lifecycle`, `status`, `notification_attempted` | No message text or contact details | Event Mode Beta |
| `event_mode_message_replied` | `app/event-mode/[code]/page.tsx` after an Event Mode reply succeeds or fails | `visibility`, `lifecycle`, `status`, `notification_attempted` | No message text or contact details | Event Mode Beta |
| `event_mode_start_quartet_clicked` | `app/event-mode/[code]/page.tsx` when a user clicks the Start quartet handoff from Event Mode | `visibility`, `lifecycle`, `availability_count`, `message_count` | No event code or message text | Event Mode Beta |

## Reproducible Dashboards

Dashboard definitions live in `analytics/posthog/dashboards.json`. They cover:

- Product Health
- Quartet Funnel
- Repertoire & Matching
- Reliability / Errors
- Event Mode Beta
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

For a narrow local test loop, sync only one or two sandbox cards instead of the
full managed dashboard set:

```sh
POSTHOG_PERSONAL_API_KEY=phx_... \
POSTHOG_HOST=https://us.posthog.com \
POSTHOG_ENVIRONMENT_ID=400013 \
npm run posthog:dashboards:sync -- --sandbox --only top-routes,analytics-client-ready
```

This creates or updates `What Can We Sing - Dashboard Sync Sandbox` with
`Sandbox - ...` insight names so production dashboard cards are not overwritten
while testing query shape and display settings.

Inspect a saved dashboard or insight directly from PostHog:

```sh
POSTHOG_PERSONAL_API_KEY=phx_... \
POSTHOG_HOST=https://us.posthog.com \
POSTHOG_ENVIRONMENT_ID=400013 \
npm run posthog:dashboards:inspect -- --dashboard "What Can We Sing - Product Health"

POSTHOG_PERSONAL_API_KEY=phx_... \
POSTHOG_HOST=https://us.posthog.com \
POSTHOG_ENVIRONMENT_ID=400013 \
npm run posthog:dashboards:inspect -- --insight "Top routes"
```

Compare a repo-managed insight against a manually edited working insight:

```sh
POSTHOG_PERSONAL_API_KEY=phx_... \
POSTHOG_HOST=https://us.posthog.com \
POSTHOG_ENVIRONMENT_ID=400013 \
npm run posthog:dashboards:compare -- --left "Top routes" --right "Manual working Top routes"
```

`POSTHOG_PROJECT_ID` is accepted as a fallback name for older PostHog docs, but
`POSTHOG_ENVIRONMENT_ID` matches the current PostHog dashboard and insight API
paths.

The sync script is idempotent by dashboard and insight name:

- existing dashboards are patched by exact name
- existing insights are patched by exact name
- missing dashboards and insights are created
- `--only insight-key-1,insight-key-2` limits sync to selected insight keys
- `--sandbox` writes selected cards to the dashboard sync sandbox and prefixes
  insight names with `Sandbox -`
- insights are created with PostHog query objects rather than legacy insight
  filters
- event-property breakdowns are generated with PostHog query `breakdowns`
  entries, for example the `Top routes` card groups `app_route_viewed` by the
  `route` event property
- trend insights are saved as PostHog visualization nodes that wrap their
  source trend/funnel query, matching the shape created by the PostHog UI
- trend insights include explicit display types so dashboard cards sync into
  the intended presentation: line graphs for time-series trends, bold numbers
  for single health counters, and bar charts for route/category/browser
  breakdowns
- after every create or update, the sync script force-refreshes the saved
  insight in the dashboard context so dashboard tiles have rendered results
  without needing each card to be opened manually
- API keys are read from environment variables only

The personal API key needs PostHog dashboard and insight read/write scopes.

## Production Verification

Use `/api/analytics/status` on the deployed app to verify the production build
has the public PostHog configuration baked in. The response intentionally
reports only safe values:

- whether `NEXT_PUBLIC_POSTHOG_KEY` is present
- whether `NEXT_PUBLIC_POSTHOG_HOST` is present
- the configured PostHog host
- the Vercel environment and commit SHA, when Vercel exposes them

The status route does not return the PostHog project key or any private API key.

When dashboards are empty, check these in order:

1. Open `/api/analytics/status` on the same deployment users are testing. If
   `posthogConfigured` is `false`, add `NEXT_PUBLIC_POSTHOG_KEY` and
   `NEXT_PUBLIC_POSTHOG_HOST` in Vercel for Production and Preview, then rebuild.
2. Confirm the dashboard sync used the same PostHog environment/project as the
   `NEXT_PUBLIC_POSTHOG_KEY`. A common failure mode is syncing dashboards with a
   personal API key against one PostHog environment while the app sends events
   with a project key from another environment.
3. If PostHog's pre-built dashboards show traffic but the repo-managed
   dashboards are empty, the app is still sending data to PostHog. In that case,
   first suspect a dashboard environment/project mismatch or managed dashboard
   event filters that do not match the deployed app version.
4. In PostHog, open Live Events and load the app in a normal browser profile
   without Brave shields, content blockers, or strict tracking protection. A page
   load should show `analytics_client_ready` and `app_route_viewed`.
5. If Live Events shows app events but dashboard cards are empty, re-run
   `npm run posthog:dashboards:sync` with the correct
   `POSTHOG_ENVIRONMENT_ID`. The managed insights depend on the script's
   current query-object format, including event-property `breakdowns` for cards
   such as `Top routes`.
6. If Live Events shows no events but `/api/analytics/status` is configured,
   check the browser network tab for blocked requests to the configured PostHog
   host. Ad blockers and privacy browsers can suppress analytics completely.

During this audit, the deployed production JavaScript was verified to include
the PostHog browser client, the public project key, the configured capture host,
and the `app_route_viewed` event code. The repo event names also match the
managed dashboard definitions. That means empty dashboards are most likely due
to a PostHog environment/project mismatch, a deployment built before env changes,
or browser blocking rather than a missing capture call in the app.

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
