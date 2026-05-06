import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const homePage = readFileSync(join(repoRoot, "app/page.tsx"), "utf8");
const appNav = readFileSync(join(repoRoot, "components/AppNav.tsx"), "utf8");
const siteFooter = readFileSync(join(repoRoot, "components/SiteFooter.tsx"), "utf8");

describe("home page links", () => {
  it("does not render duplicate profile or help links in the home page body", () => {
    expect(homePage).not.toContain('href="/settings"');
    expect(homePage).not.toContain('href="/help"');
  });

  it("keeps normal navigation and footer help links available", () => {
    expect(appNav).toContain('href: "/"');
    expect(appNav).toContain('label: "Home"');
    expect(appNav).toContain('href: "/settings"');
    expect(appNav).toContain('href: "/help"');
    expect(siteFooter).toContain('href: "/help"');
    expect(siteFooter).toContain("Help & Feedback");
  });

  it("adds Event Mode as a secondary home action without displacing quartet flows", () => {
    expect(homePage).toContain("Start a quartet");
    expect(homePage).toContain("Join a quartet");
    expect(homePage).toContain("My Songs");
    expect(homePage).toContain("Event Mode");
    expect(homePage).toContain(
      "At a convention, afterglow, or singing event? Find other"
    );
    expect(homePage).toContain('href="/event-mode"');
    expect(homePage).toContain('href="/event-mode?create=1"');
    expect(homePage).toContain("Find my event");
    expect(homePage).toContain("Create an event");
  });
});
