# Recently Sung Events

Issue #88 added a private event log for songs a user marks as sung from quartet
results. Issue #179 also stores personal sung metadata on `user_repertoire`.
Users can also mark a saved song as sung directly from My Songs; those events
do not have a quartet session id.

The event schema and RLS requirement is captured in
`supabase/migrations/20260428060000_supabase_contract_alignment.sql`. The
repertoire metadata and `mark_repertoire_sung` database function are captured in
`supabase/migrations/20260428145000_add_repertoire_sung_metadata.sql` and
`supabase/migrations/20260501210000_allow_repertoire_mark_sung_without_session.sql`.
Production migrations are deployed by GitHub Actions after merge. For local
development or emergency fallback, see `docs/deployment-automation.md`.

Events are private to the user who marked the song. They are not copied into
quartet participant snapshots and do not affect matching rank yet. The database
function updates only the authenticated user's selected repertoire row and then
records the private event. When marked from a quartet, the event includes the
quartet session id; when marked from My Songs, `session_id` is null.
