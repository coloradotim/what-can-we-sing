import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const ciWorkflow = readFileSync(
  join(repoRoot, ".github/workflows/ci.yml"),
  "utf8"
);
const migrationWorkflow = readFileSync(
  join(repoRoot, ".github/workflows/supabase-migrations.yml"),
  "utf8"
);
const deploymentDocs = readFileSync(
  join(repoRoot, "docs/deployment-automation.md"),
  "utf8"
);

describe("deployment automation guardrails", () => {
  it("runs required PR checks before merge", () => {
    expect(ciWorkflow).toContain("pull_request:");
    expect(ciWorkflow).toContain("Check migration filenames");
    expect(ciWorkflow).toContain("Check for committed secret values");
    expect(ciWorkflow).toContain("npm run test:run");
    expect(ciWorkflow).toContain("npm run build");
  });

  it("deploys Supabase migrations only from main", () => {
    expect(migrationWorkflow).toContain("branches: [main]");
    expect(migrationWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(migrationWorkflow).not.toContain("pull_request:");
    expect(migrationWorkflow).toContain("supabase/migrations/**");
    expect(migrationWorkflow).toContain("supabase --yes db push");
  });

  it("keeps production Supabase credentials in GitHub Actions secrets", () => {
    for (const secretName of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL"]) {
      expect(migrationWorkflow).toContain(`secrets.${secretName}`);
      expect(deploymentDocs).toContain(secretName);
    }
  });

  it("documents merge, branch protection, auto-merge, and failure recovery", () => {
    expect(deploymentDocs).toContain("Branch Protection");
    expect(deploymentDocs).toContain("Require a pull request before merging");
    expect(deploymentDocs).toContain("Auto-Merge Guidance");
    expect(deploymentDocs).toContain("Failure Recovery");
    expect(deploymentDocs).toContain("CI / test-and-build (pull_request)");
    expect(deploymentDocs).toContain("CI / guardrails (pull_request)");
    expect(deploymentDocs).toContain(
      "Do not require the `Supabase Migrations` workflow as a pre-merge PR check"
    );
    expect(deploymentDocs).toContain(
      "Supabase migrations are not deployed from unmerged PR branches"
    );
  });
});
