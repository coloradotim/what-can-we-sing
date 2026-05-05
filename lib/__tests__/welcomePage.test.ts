import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const welcomePage = readFileSync(
  join(process.cwd(), "app/welcome/page.tsx"),
  "utf8"
);
const loginPage = readFileSync(join(process.cwd(), "app/login/page.tsx"), "utf8");

describe("first-login welcome page", () => {
  it("explains the quick-start app flow", () => {
    expect(welcomePage).toContain("Welcome to What Can We Sing");
    expect(welcomePage).toContain("Set your display name");
    expect(welcomePage).toContain("Add a few songs you know");
    expect(welcomePage).toContain("Start a quartet or join one");
    expect(welcomePage).toContain("Use the match list");
    expect(welcomePage).toContain("You can always add more songs later");
  });

  it("marks the welcome as seen and routes to the right setup step", () => {
    expect(welcomePage).toContain("markWelcomeSeen");
    expect(welcomePage).toContain('hasDisplayName ? "/songs" : "/settings"');
  });

  it("skips returning users with profile, repertoire, or quartet history", () => {
    expect(welcomePage).toContain("profile?.has_seen_welcome");
    expect(welcomePage).toContain("repertoire.length > 0");
    expect(welcomePage).toContain("hasQuartetWorkflowHistory");
  });

  it("routes successful logins through welcome with the intended destination preserved", () => {
    expect(loginPage).toContain('new URL("/welcome", window.location.origin)');
    expect(loginPage).toContain('welcomeUrl.searchParams.set("redirect", postLoginPath)');
  });
});
