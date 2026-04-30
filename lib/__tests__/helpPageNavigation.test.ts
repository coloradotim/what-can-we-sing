import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const helpPage = readFileSync(join(repoRoot, "app/help/page.tsx"), "utf8");

describe("help page navigation", () => {
  it("keeps the intro aligned to the same help container as the nav and sections", () => {
    expect(helpPage).toContain('className="mx-auto max-w-4xl"');
    expect(helpPage).toContain("helpIntroParagraphClass");
    expect(helpPage).not.toContain("max-w-3xl text-base leading-7");
  });

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

  it("links the friendly intro copy to the feedback form", () => {
    expect(helpPage).toContain("helpWelcomeCopy");
    expect(helpPage).toContain('href="#feedback"');
    expect(helpPage).toContain("feedback form");
  });

  it("auto-selects general feedback for the feedback form", () => {
    expect(helpPage).toContain(
      'useState<FeedbackType>("General feedback")'
    );
  });
});
