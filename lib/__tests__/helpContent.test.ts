import { describe, expect, it } from "vitest";
import {
  helpGuideSections,
  helpSections,
  feedbackHelpCopy,
  quickStartSteps,
} from "../helpContent";

describe("help content", () => {
  const guideText = helpGuideSections
    .map((section) =>
      [
        section.eyebrow,
        section.title,
        section.intro,
        ...section.topics.flatMap((topic) => [
          topic.title,
          ...topic.body,
          ...(topic.bullets ?? []),
        ]),
      ].join(" ")
    )
    .join(" ");

  it("covers the core new-user flow", () => {
    expect(quickStartSteps.join(" ")).toContain("display name");
    expect(quickStartSteps.join(" ")).toContain("repertoire");
    expect(quickStartSteps.join(" ")).toContain("code");

    const sectionText = helpSections
      .map((section) => `${section.title} ${section.body.join(" ")}`)
      .join(" ");

    expect(sectionText).toContain("pickup quartet");
    expect(sectionText).toContain("Start");
    expect(sectionText).toContain("join");
    expect(sectionText).toContain("Possible matches");
    expect(sectionText).toContain("display name");
    expect(sectionText).toContain("Leaving removes you");
    expect(feedbackHelpCopy).toContain("Report a bug");
    expect(feedbackHelpCopy).toContain("confusing behavior");
  });

  it("is organized into onboarding, repertoire, and quartet guidance", () => {
    expect(helpGuideSections.map((section) => section.title)).toEqual([
      "Get Singing Quickly",
      "Manage The Songs You Know",
      "Understand What Your Pick-Up Quartet Can Sing",
    ]);

    expect(guideText).toContain("First Time Setup");
    expect(guideText).toContain("you do not need to enter your entire repertoire");
    expect(guideText).toContain("Song Title Autocomplete");
    expect(guideText).toContain("Suggestions are optional");
    expect(guideText).toContain("does not add it to anyone else’s repertoire");
    expect(guideText).toContain("TTBB means Tenor, Lead, Baritone, Bass");
    expect(guideText).toContain("add it more than once");
    expect(guideText).toContain("A singer may know multiple parts");
    expect(guideText).toContain("each singer can only cover one required part");
    expect(guideText).toContain("no arranger entered");
    expect(guideText).toContain("Unknown");
    expect(guideText).toContain("Notes are for your own memory");
    expect(guideText).toContain("Recently sung helps you remember");
    expect(guideText).toContain("sort by title");
    expect(guideText).toContain("Never Sung");
  });

  it("explains quartet match details and management", () => {
    expect(guideText).toContain("Ready to Sing");
    expect(guideText).toContain("Possible matches");
    expect(guideText).toContain("voicing, required part coverage");
    expect(guideText).toContain("distinct singers");
    expect(guideText).toContain("Title variants");
    expect(guideText).toContain("arranger differences");
    expect(guideText).toContain("Open a match to see who is covering which part");
    expect(guideText).toContain("use Manage to see quartet members");
    expect(guideText).toContain("edit repertoire");
    expect(guideText).toContain("Leaving removes you from the active quartet");
    expect(guideText).toContain("you can rejoin normally");
  });
});
