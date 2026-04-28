import { describe, expect, it } from "vitest";
import { helpSections, quickStartSteps } from "../helpContent";

describe("help content", () => {
  it("covers the core new-user flow", () => {
    expect(quickStartSteps.join(" ")).toContain("display name");
    expect(quickStartSteps.join(" ")).toContain("repertoire");
    expect(quickStartSteps.join(" ")).toContain("code");

    const sectionText = helpSections
      .map((section) => `${section.title} ${section.body.join(" ")}`)
      .join(" ");

    expect(sectionText).toContain("pickup quartet");
    expect(sectionText).toContain("Start");
    expect(sectionText).toContain("Join");
    expect(sectionText).toContain("Possible Matches");
    expect(sectionText).toContain("display name");
    expect(sectionText).toContain("Leave quartet");
    expect(sectionText).toContain("feedback");
  });
});
