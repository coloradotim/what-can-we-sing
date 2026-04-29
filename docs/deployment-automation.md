# Deployment Automation

This repo uses GitHub Actions to keep Codex-authored PRs reviewable while
removing the easy-to-forget manual Supabase migration step.

## PR Lifecycle

1. Codex creates a feature branch and opens a PR.
2. The `CI` workflow runs on the PR.
3. The maintainer reviews the PR.
4. GitHub auto-merge may merge the PR after required checks and any required
   approvals pass.
5. Vercel deploys the app from `main`.
6. If the merge includes files under `supabase/migrations`, the
   `Supabase Migrations` workflow applies them to the production Supabase
   project after the code is on `main`.

Supabase migrations are not deployed from unmerged PR branches.

## CI Checks

The `CI` workflow runs on pull requests and pushes to `main`.

Required checks:
- Migration filenames use `YYYYMMDDHHMMSS_descriptive_name.sql`.
- Obvious committed secret values are rejected.
- `npm run test:run`.
- `npm run build`.

## Supabase Migration Deployment

The `Supabase Migrations` workflow runs only on `main` pushes that touch
`supabase/migrations/**` or the migration workflow itself. It can also be rerun
manually with `workflow_dispatch`.

The workflow:
- installs the Supabase CLI
- verifies required GitHub Actions secrets are present
- runs `supabase --yes db push` against the configured database URL
- fails visibly if migration deployment fails

Required GitHub Actions secrets:
- `SUPABASE_ACCESS_TOKEN`: Supabase personal access token for CI
- `SUPABASE_DB_URL`: production Supabase session-pooler database URI used by `supabase db push`
- `NEXT_PUBLIC_SUPABASE_URL`: used by the app build in CI
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: used by the app build in CI

Do not commit these values. Do not use a service-role key in frontend code.

## Branch Protection

Configure GitHub branch protection for `main` in repository settings:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require the `CI / test-and-build (pull_request)` check.
- Require the `CI / guardrails (pull_request)` check.
- Optionally require one approval before merging.
- Prevent direct pushes to `main` where practical.
- Allow auto-merge only after required checks and approvals pass.

Do not require the `Supabase Migrations` workflow as a pre-merge PR check. It
runs after migration changes merge to `main`.

These settings are repository settings and are not stored in the codebase.

## Auto-Merge Guidance

For trusted Codex PRs, the maintainer may enable GitHub auto-merge after review.
Auto-merge should wait for required CI checks and any required approval. Do not
merge or auto-merge PRs with failing tests, failing builds, or failed guardrails.

## Failure Recovery

If the `Supabase Migrations` workflow fails after a merge:

1. Treat production app code as potentially ahead of the database.
2. Open the failed GitHub Actions run and read the failed step.
3. Fix the migration or missing secret in a new PR.
4. Merge the fix to `main`, or rerun the failed workflow after correcting only
   repository secrets/configuration.
5. Confirm the migration workflow passes before relying on the affected app
   behavior.

Manual `supabase db push` is now a fallback only, not the primary workflow.
