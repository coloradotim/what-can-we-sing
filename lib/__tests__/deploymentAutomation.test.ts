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
const productionDeployWorkflow = readFileSync(
  join(repoRoot, ".github/workflows/production-deploy.yml"),
  "utf8"
);
const vercelConfig = readFileSync(join(repoRoot, "vercel.json"), "utf8");
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

  it("deploys production only after tests and migrations succeed", () => {
    expect(productionDeployWorkflow).toContain("branches: [main]");
    expect(productionDeployWorkflow).toContain("npm run test:run");
    expect(productionDeployWorkflow).toContain("npm run build");
    expect(productionDeployWorkflow).toContain("Detect migration changes");
    expect(productionDeployWorkflow).toContain("supabase --yes db push");
    expect(productionDeployWorkflow).toContain("vercel build --prod");
    expect(productionDeployWorkflow).toContain(
      "vercel deploy --prebuilt --prod"
    );
    expect(
      productionDeployWorkflow.indexOf("Apply Supabase migrations")
    ).toBeLessThan(
      productionDeployWorkflow.indexOf("Deploy Vercel production output")
    );
  });

  it("keeps Supabase migration workflow as manual recovery only", () => {
    expect(migrationWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(migrationWorkflow).not.toContain("pull_request:");
    expect(migrationWorkflow).not.toContain("push:");
    expect(migrationWorkflow).toContain("group: production-deploy");
    expect(migrationWorkflow).toContain("supabase --yes db push");
  });

  it("keeps production Supabase credentials in GitHub Actions secrets", () => {
    for (const secretName of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL"]) {
      expect(migrationWorkflow).toContain(`secrets.${secretName}`);
      expect(productionDeployWorkflow).toContain(`secrets.${secretName}`);
      expect(deploymentDocs).toContain(secretName);
    }
  });

  it("keeps production Vercel deployment controlled by GitHub Actions", () => {
    expect(vercelConfig).toContain('"main": false');
    for (const secretName of [
      "VERCEL_TOKEN",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
    ]) {
      expect(productionDeployWorkflow).toContain(`secrets.${secretName}`);
      expect(deploymentDocs).toContain(secretName);
    }
    expect(deploymentDocs).toContain(
      "automatic Git deployments for `main`"
    );
    expect(deploymentDocs).toContain("Production Deploy");
    expect(deploymentDocs).toContain("vercel inspect <deployment-url>");
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
    expect(deploymentDocs).toContain("Vercel free-tier build or deployment limits");
    expect(deploymentDocs).toContain("Production Deploy` passes");
  });
});
