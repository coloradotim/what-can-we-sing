import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const doc = readFileSync(
  join(process.cwd(), "docs/production-readiness.md"),
  "utf8"
);

describe("production readiness docs", () => {
  it("documents service limits and preflight checks", () => {
    expect(doc).toContain("Vercel");
    expect(doc).toContain("Supabase Auth");
    expect(doc).toContain("Supabase Realtime");
    expect(doc).toContain("Resend");
    expect(doc).toContain("PostHog");
    expect(doc).toContain("Event Preflight");
  });
});
