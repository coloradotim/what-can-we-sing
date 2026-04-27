# What Can We Sing — Agent Context

## Product
What Can We Sing helps barbershop singers in pickup quartets quickly identify songs they can sing together. Users maintain a personal repertoire of songs, voicing, parts known, arranger if known, and confidence. In a session, 2–4 singers join by QR/link and see shared match results.

The app is for practical, in-the-room decision-making, not archival repertoire management. Prefer clear, fast, forgiving UX over perfect music-library correctness.

## Core domain rules
- A valid quartet match requires distinct singers assigned to distinct required parts.
- TTBB parts: Tenor, Lead, Baritone, Bass.
- SATB parts: Soprano, Alto, Tenor, Bass.
- SSAA parts: Soprano 1, Soprano 2, Alto 1, Alto 2.
- Same title + same voicing can be grouped, but different arrangers or missing arrangers should be flagged as possible matches, not ignored.
- Do not combine different voicings.
- Repertoire is cloud-backed in Supabase.
- Sessions store participant repertoire snapshots; users can refresh their snapshot.

## Barbershop-specific context
- Pickup quartets often form informally at rehearsals, conventions, afterglows, or social singing events.
- The core user question is: “What can we sing together right now?”
- Barbershop voice parts are not interchangeable:
  - TTBB: Tenor, Lead, Baritone, Bass
  - SSAA: Soprano 1, Soprano 2, Alto 1, Alto 2
  - SATB: Soprano, Alto, Tenor, Bass
- “Lead” is the melody part in most TTBB barbershop arrangements; do not rename it to “Melody.”
- Do not treat “Tenor” in TTBB and “Tenor” in SATB as equivalent across voicings.
- A singer may know multiple parts to the same arrangement, but a single valid quartet assignment cannot use one singer for more than one part.
- Barbershop songs may exist in multiple arrangements. Title alone is not always enough.
- Arranger is optional because singers often do not know it, but when arrangers differ, the app should warn users rather than silently treat the arrangements as identical.
- Missing arranger should not block matching; it should create a “possible match / confirm arrangement” warning.
- The app should be forgiving of imperfect data and help singers decide quickly, not enforce a perfect catalog.

## Part abbreviations (UI standard)

Use the following abbreviations consistently in all user-facing UI:

TTBB:
- T = Tenor
- L = Lead
- Bari = Baritone
- Bass = Bass

SATB:
- S = Soprano
- A = Alto
- T = Tenor
- Bass = Bass

SSAA:
- S1 = Soprano 1
- S2 = Soprano 2
- A1 = Alto 1
- A2 = Alto 2

Notes:
- Do not invent alternative abbreviations.
- Do not spell out full part names in compact list views.
- Always prioritize readability and scannability on mobile.

## Tech stack
- Next.js App Router
- TypeScript
- Tailwind
- Supabase Auth/Postgres/Realtime
- Vitest for matching logic tests
- Vercel deploys from GitHub

## Workflow
Before finishing any change:
- run `npm run test:run`
- run `npm run build`
- do not change app behavior unless requested
- prefer small PRs
- preserve existing tests and add tests for matching logic changes

## Important files
- `lib/matching.ts`: core matching/ranking logic
- `lib/__tests__/matching.test.ts`: matching tests
- `lib/sessionStore.ts`: sessions/participants/realtime
- `lib/repertoireStore.ts`: cloud repertoire
- `app/join/[code]/page.tsx`: session join/results
- `app/repertoire/page.tsx`: repertoire management