# Deployment Automation

This repo uses GitHub Actions to keep Codex-authored PRs reviewable, apply
Supabase migrations before production app deployment, and avoid production
deploys that race ahead of the database.

## PR Lifecycle

1. Codex creates a feature branch and opens a PR.
2. The `CI` workflow runs on the PR.
3. The maintainer reviews the PR.
4. GitHub auto-merge may merge the PR after required checks and any required
   approvals pass.
5. The `Production Deploy` workflow runs from `main`.
6. `Production Deploy` runs tests and build again on the merge commit.
7. If the merge includes files under `supabase/migrations`, `Production Deploy`
   applies them to the production Supabase project.
8. Only after the migration step is skipped or succeeds, `Production Deploy`
   builds and deploys the Vercel production app.

Supabase migrations are not deployed from unmerged PR branches.

Vercel preview deployments may still be created automatically for PR branches.
That is useful for review and is separate from production readiness.

## CI Checks

The `CI` workflow runs on pull requests and pushes to `main`.

Required checks:
- Migration filenames use `YYYYMMDDHHMMSS_descriptive_name.sql`.
- Obvious committed secret values are rejected.
- `npm run test:run`.
- `npm run build`.

## Production Deployment

The `Production Deploy` workflow is the intended production deployment path. It
runs on pushes to `main` and can also be run manually with `workflow_dispatch`.

The workflow:
- installs dependencies
- runs `npm run test:run`
- runs `npm run build`
- checks whether the merge included migration workflow or
  `supabase/migrations/**` changes
- applies Supabase migrations first when needed
- verifies Vercel deployment secrets are present
- runs `vercel pull --environment=production`
- runs `vercel build --prod`
- runs `vercel deploy --prebuilt --prod`

If the Supabase migration step fails, the Vercel deployment steps do not run.
That makes the failure visible in GitHub Actions and prevents the GitHub Actions
production deploy from presenting app code as healthy while the database is
behind.

## Vercel Git Integration

`vercel.json` disables automatic Git deployments for the `main` branch:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

This keeps production deploys sequenced through GitHub Actions. Leave Vercel's
Git integration connected for PR preview deployments, but do not rely on Vercel
automatic production deployment from `main`.

If production deployments still start immediately after a merge, check the
Vercel project settings and confirm the project is reading this repository's
`vercel.json`. The intended setting is: automatic Git deployments for `main`
disabled; GitHub Actions `Production Deploy` owns production.

## Manual Supabase Migration Recovery

The `Supabase Migrations` workflow is now a manual recovery workflow. It runs
only with `workflow_dispatch` on `main`. It shares the production deployment
concurrency group so it cannot run at the same time as `Production Deploy`.

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
- `VERCEL_TOKEN`: Vercel token used by GitHub Actions production deploys
- `VERCEL_ORG_ID`: Vercel team/user id for the linked project
- `VERCEL_PROJECT_ID`: Vercel project id for the linked project

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

Do not require the `Supabase Migrations` workflow as a pre-merge PR check. It is
a manual recovery workflow. The post-merge production readiness signal is
`Production Deploy / Test, migrate, and deploy`.

These settings are repository settings and are not stored in the codebase.

## Auto-Merge Guidance

For trusted Codex PRs, the maintainer may enable GitHub auto-merge after review.
Auto-merge should wait for required CI checks and any required approval. Do not
merge or auto-merge PRs with failing tests, failing builds, or failed guardrails.

## Failure Recovery

If the `Production Deploy` workflow fails during the Supabase migration step:

1. Treat production deployment as failed.
2. Open the failed GitHub Actions run and read the failed step.
3. Fix the migration or missing secret in a new PR.
4. Merge the fix to `main`, or rerun `Production Deploy` after correcting only
   repository secrets/configuration.
5. Confirm `Production Deploy` passes before relying on the affected behavior.

If you need to apply migrations without deploying the app, run the manual
`Supabase Migrations` workflow from `main` after fixing secrets/configuration.

Manual `supabase db push` is now a fallback only, not the primary workflow.

## Vercel Free-Tier Limits

Vercel free-tier build or deployment limits can still block production deploys.
When that happens, GitHub Actions will show the failed Vercel step. The code on
`main` remains up to date, but production may still be serving an older
deployment until the limit resets and `Production Deploy` is rerun.

After limits reset, rerun the failed `Production Deploy` workflow from GitHub
Actions. You do not need to create a no-op code change just to redeploy.

## Verifying Production

To verify what is live:

1. Open GitHub Actions and confirm the latest `Production Deploy` run for
   `main` passed.
2. If that run included migrations, confirm the `Apply Supabase migrations` step
   passed before the Vercel deploy steps.
3. In Vercel, inspect the latest production deployment and compare its Git
   commit SHA to the `main` commit from the successful `Production Deploy` run.
   The Vercel CLI equivalent is `vercel list --prod` followed by
   `vercel inspect <deployment-url>`.
4. If analytics are configured, `/api/analytics/status` can help confirm the
   deployed Vercel environment and commit metadata exposed to the app runtime.
