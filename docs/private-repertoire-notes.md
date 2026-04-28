# Private Repertoire Notes

Issue #87 adds optional private notes to each `user_repertoire` row.

This schema requirement is now captured in
`supabase/migrations/20260428060000_supabase_contract_alignment.sql`.
Production migrations are deployed by GitHub Actions after merge. For local
development or emergency fallback, see `docs/deployment-automation.md`.

No changes are needed to session participant data. Notes stay in
`user_repertoire` and are not copied into quartet snapshots.
