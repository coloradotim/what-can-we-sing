# Private Repertoire Notes

Issue #87 adds optional private notes to each `user_repertoire` row.

Apply this SQL once in the Supabase SQL editor before deploying the feature:

```sql
alter table public.user_repertoire
add column if not exists notes text;
```

No changes are needed to session participant data. Notes stay in
`user_repertoire` and are not copied into quartet snapshots.
