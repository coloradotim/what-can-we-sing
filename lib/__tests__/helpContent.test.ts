import { describe, expect, it } from "vitest";
import { helpSections, quickStartSteps } from "../helpContent";

describe("help content", () => {
  it("covers the core new-user flow", () => {
    expect(quickStartSteps.join(" ")).toContain("display name");
    expect(quickStartSteps.join(" ")).toContain("songs");
    expect(quickStartSteps.join(" ")).toContain("code");

    const sectionText = helpSections
      .map((section) => `${section.title} ${section.body}`)
      .join(" ");

    expect(sectionText).toContain("pickup quartet");
    expect(sectionText).toContain("Start");
    expect(sectionText).toContain("Join");
    expect(sectionText).toContain("Possible matches");
    expect(sectionText).toContain("display name");
  });
});
