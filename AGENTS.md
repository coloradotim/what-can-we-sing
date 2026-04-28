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
Use the local repo at `~/Documents/Codex/what-can-we-sing`.

When the user asks to `work issue #X`, treat that as instruction to implement
GitHub issue `#X` using the standard issue workflow:

1. Read `AGENTS.md`.
2. Check out `main`.
3. Pull latest `origin/main`.
4. Create a feature branch named for the issue, using the `codex/` prefix unless
   the user requests a different name.
5. Make the requested changes.
6. Consider whether documentation needs to be updated.
7. Consider whether tests need to be updated.
8. Run `npm run test:run`.
9. Run `npm run build`.
10. Commit changes to the feature branch.
11. Push the branch.
12. Open a PR that links the issue.
13. If the repository allows auto-merge, enable auto-merge on the PR.
14. If all required checks pass and branch protection allows it, allow the PR to
    merge through the protected-branch/auto-merge path.
15. If auto-merge or merge is blocked, report the exact blocker, such as a
    failing check, pending required check, branch protection rule, merge
    conflict, review requirement, or permissions issue.

Before finishing any change:
- run `npm run test:run`
- run `npm run build`
- do not change app behavior unless requested
- prefer small PRs
- preserve existing tests and add tests for matching logic changes
- when adding or changing Supabase operations, update migrations/RLS,
  `docs/supabase-contract.md`, and related tests or test notes
- enable auto-merge where branch protection and repository settings allow it
- if the PR cannot be merged or auto-merged, clearly report the blocker

Every PR should explicitly consider docs and tests. Update docs when a change
affects user-visible behavior, setup, deployment, environment variables,
Supabase schema/RLS/contracts, analytics events, matching logic,
auth/session behavior, or major app flows. Update tests when a change affects
business logic, data flow, matching, Supabase helpers, auth/session behavior,
UI state transitions, or regression-prone bugs. If docs or tests are not
updated, explain why in the PR.

Supabase changes must be captured in repo migrations and docs rather than
dashboard-only changes. If a change requires schema, RLS, or data-model updates,
add a proper migration and update `docs/supabase-contract.md` as needed.
Production Supabase migrations should be deployed by the automated GitHub
Actions workflow after merge to `main`. If automation is unavailable or a
manual step remains, document that clearly in the PR.

For normal repo work, ask early for any needed access: repo file writes, Git
metadata writes, network access for Git/package/build/font resources, pushing
branches, and opening PRs.

Guardrails:
- do not commit directly to `main`
- do not commit secrets
- do not use service-role keys in browser code
- do not bypass failing tests or builds
- do not bypass branch protection or required checks
- do not force-merge blocked PRs
- do not deploy production Supabase changes outside the approved migration
  deployment workflow

## Important files
- `lib/matching.ts`: core matching/ranking logic
- `lib/__tests__/matching.test.ts`: matching tests
- `lib/sessionStore.ts`: sessions/participants/realtime
- `lib/repertoireStore.ts`: cloud repertoire
- `app/join/[code]/page.tsx`: session join/results
- `app/repertoire/page.tsx`: repertoire management
