# Recently Sung Events

Issue #88 adds a private event log for songs a user marks as sung from quartet
results.

This schema and RLS requirement is now captured in
`supabase/migrations/20260428060000_supabase_contract_alignment.sql`. Apply
unapplied migrations with `supabase db push`.

Events are private to the user who marked the song. They are not copied into
quartet participant snapshots and do not affect matching rank yet.
