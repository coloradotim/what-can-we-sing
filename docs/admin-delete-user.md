# Admin User Deletion

Use `npm run admin:delete-user` when a user asks for account deletion or when
an operator needs to remove a test account from Supabase. The script uses the
Supabase service-role key from the local shell environment only. Never expose
that key in browser code, checked-in files, or client-visible environment
variables.

## Required Environment

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`

Optional production guard:

- `WCWS_ADMIN_ENV=production` or `VERCEL_ENV=production`

When either production flag is present, confirmed deletion requires both
`--confirm` and `--confirm-production`.

## Dry Run First

The script defaults to dry-run mode. It accepts only exact identifiers and
does not support fuzzy matching or wildcards.

```sh
npm run admin:delete-user -- --email singer@example.com
npm run admin:delete-user -- --user-id 00000000-0000-0000-0000-000000000000
```

The dry run prints counts only. It does not print repertoire titles, feedback
message content, notes, or other private free text.

## Confirm Deletion

```sh
npm run admin:delete-user -- --email singer@example.com --confirm
```

For production:

```sh
WCWS_ADMIN_ENV=production npm run admin:delete-user -- --email singer@example.com --confirm --confirm-production
```

## What It Deletes

- Supabase auth user
- `profiles` row, including display name and lightweight preferences such as
  `has_seen_welcome`
- `user_repertoire` rows
- `session_participants` rows
- `sung_song_events` rows

The script deletes user-owned app rows before deleting the Supabase auth user,
then deletes the auth user through `supabase.auth.admin.deleteUser`.

## What It Preserves

- Shared `sessions` rows
- Shared/global `song_suggestion_catalog` rows
- PostHog analytics events
- Resend email delivery logs
- Feedback email content already delivered outside Supabase

The app does not store feedback submissions in a Supabase feedback table.

## Verification

After a confirmed deletion, run the same command without `--confirm`. It should
report that no Supabase auth user matches the exact email or user ID. You can
also verify in the Supabase dashboard that the auth user is gone and the
user-owned table counts are zero.
