# Test Coverage Notes

This file tracks high-risk behavior that should stay covered as the app changes.

## Covered In Unit Tests

- Matching rules, ranking, fuzzy title suggestions, arranger warnings, distinct
  singer assignment, per-part confidence, and part abbreviations.
- Join code parsing, auth route guards, post-login redirects, and active quartet
  local-storage helpers.
- Participant resolution by `user_id`, including rejoin recognition when a
  display name changes or the quartet is already full.
- Realtime participant payload application for insert, update, and delete
  events.
- Detecting when the current participant has been removed from a quartet.
- Building participant snapshot entries from profile display names and
  repertoire rows without leaking private notes.
- Refreshing an active quartet snapshot from current My Songs entries, clearing stale
  local active-quartet state when the user is no longer a participant, and
  refusing to write a snapshot without a display name.
- `sessionStore` write helpers for participant upsert, leave/delete, and
  remove-by-id RPC calls, including verification that database writes changed
  the intended row.
- Repertoire filtering/sorting, mark-as-sung resolution, feedback helpers,
  analytics property sanitization, deployment guardrails, Supabase contract
  guardrails, and Help page content coverage.

## Remaining Gaps

- The suite still does not run a browser-level test for the full start -> join
  -> edit My Songs -> refresh matches -> leave/remove flow. The current tests
  cover the pure helpers and store calls underneath those flows.
- The suite does not execute RLS policies against a real Supabase instance.
  `docs/supabase-contract.md` describes the smallest follow-up: add
  Supabase CLI-backed integration tests with fixture auth users.
- The quartet page is large and currently difficult to mount in a focused unit
  test without broad Supabase and browser mocks. If regressions continue in that
  page, the smallest useful refactor is to extract more state-transition helpers
  for full-quartet, left/rejoin, and match-refresh UI states.

## Future Checklist

When changing quartet or My Songs data flow, add or update tests that prove:

- database helpers read/write the expected Supabase table or RPC
- stale local active-quartet state is reconciled against database state
- My Songs edits refresh `session_participants.repertoire` when applicable
- matching derives from participant snapshots, not local-only component state
- UI copy does not imply a user joined, left, or refreshed before the database
  operation has been verified
