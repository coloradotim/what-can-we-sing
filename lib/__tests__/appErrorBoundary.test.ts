import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appError = readFileSync(join(process.cwd(), "app/error.tsx"), "utf8");

describe("app error boundary", () => {
  it("shows a friendly retry fallback without raw stack text", () => {
    expect(appError).toContain("The app hit a temporary issue.");
    expect(appError).toContain("temporary service limit");
    expect(appError).toContain("Try again");
    expect(appError).not.toContain("error.message");
  });
});
