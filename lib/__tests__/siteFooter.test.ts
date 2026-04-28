import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const footer = readFileSync(join(repoRoot, "components/SiteFooter.tsx"), "utf8");
const layout = readFileSync(join(repoRoot, "app/layout.tsx"), "utf8");

describe("site footer", () => {
  it("uses the required footer text and links", () => {
    expect(footer).toContain("&copy; 2026 What Can We Sing");
    expect(footer).toContain("Help & Feedback");
    expect(footer).toContain('href: "/help"');
    expect(footer).toContain("Privacy");
    expect(footer).toContain('href: "/privacy"');
    expect(footer).toContain("GitHub");
    expect(footer).toContain("https://github.com/coloradotim/what-can-we-sing");
  });

  it("is rendered from the root layout", () => {
    expect(layout).toContain("SiteFooter");
    expect(layout).toContain("<SiteFooter />");
  });
});
