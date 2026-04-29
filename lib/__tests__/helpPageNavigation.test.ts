import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const helpPage = readFileSync(join(repoRoot, "app/help/page.tsx"), "utf8");

describe("help page navigation", () => {
  it("renders a compact on-page navigation from shared help nav items", () => {
    expect(helpPage).toContain("helpNavItems");
    expect(helpPage).toContain("On this page");
    expect(helpPage).toContain('href={`#${item.id}`}');
    expect(helpPage).toContain("Help page sections");
  });

  it("adds stable scroll targets for guide sections and feedback", () => {
    expect(helpPage).toContain("id={section.id}");
    expect(helpPage).toContain('id="feedback"');
    expect(helpPage).toContain("scroll-mt-6");
  });
});
