import { describe, expect, it } from "vitest";
import {
  helpAcknowledgments,
  helpAcknowledgmentsIntro,
  helpDevelopmentNote,
  helpGuideSections,
  helpSections,
  feedbackHelpCopy,
  helpFeedbackInvitationCopy,
  helpNavItems,
  helpSongSuggestionSources,
  helpWelcomeCopy,
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
    expect(quickStartSteps.join(" ")).toContain("songs");
    expect(quickStartSteps.join(" ")).toContain("Harmony Brigade");
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
    expect(feedbackHelpCopy).toContain("General feedback");
  });

  it("is organized into onboarding, My Songs, and quartet guidance", () => {
    expect(helpGuideSections.map((section) => section.title)).toEqual([
      "Get Singing Quickly",
      "Manage The Songs You Know",
      "Start A Quartet For The Group",
      "Join A Quartet Someone Else Started",
      "Understand What Your Pick-Up Quartet Can Sing",
      "Update, Leave, Or Rejoin A Quartet",
    ]);

    expect(helpGuideSections.map((section) => section.id)).toEqual([
      "first-time-setup",
      "repertoire",
      "starting-a-quartet",
      "joining-a-quartet",
      "quartet-matches",
      "managing-a-quartet",
    ]);

    expect(guideText).toContain("First Time Setup");
    expect(guideText).toContain("copy songs from another singer");
    expect(guideText).toContain("Harmony Brigade songs");
    expect(guideText).toContain("Song Title Autocomplete");
    expect(guideText).toContain("Suggestions are optional");
    expect(guideText).toContain("does not add it to anyone else’s saved songs");
    expect(guideText).toContain("More Ways To Build My Songs");
    expect(guideText).toContain("Treble (SSAA)");
    expect(guideText).toContain("Mixed (SATB)");
    expect(guideText).toContain("Lower voice (TTBB)");
    expect(guideText).toContain("is often printed as Tenor");
    expect(guideText).toContain("Alto to Lead");
    expect(guideText).toContain("T2 to Lead");
    expect(guideText).toContain("add it more than once");
    expect(guideText).toContain("A singer may know multiple parts");
    expect(guideText).toContain("each singer can only cover one required part");
    expect(guideText).toContain("no arranger entered");
    expect(guideText).toContain("Unknown");
    expect(guideText).toContain("Notes are for your own memory");
    expect(guideText).toContain("Last sung is based on songs");
    expect(guideText).toContain("sort by title");
    expect(guideText).toContain("Sung filter");
    expect(guideText).toContain("not marked sung");
    expect(guideText).toContain("Open Filters");
  });

  it("explains quartet match details and management", () => {
    expect(guideText).toContain("Start creates a quartet session");
    expect(guideText).toContain("code, QR code, and shareable link");
    expect(guideText).toContain("You are part of the quartet you start");
    expect(guideText).toContain("Starting a quartet does not permanently change");
    expect(guideText).toContain("Use Join when another singer");
    expect(guideText).toContain("Joining does not add songs");
    expect(guideText).toContain("If the quartet is full");
    expect(guideText).toContain("Ready to Sing");
    expect(guideText).toContain("Possible matches");
    expect(guideText).toContain("arrangement voicing, required part coverage");
    expect(guideText).toContain("distinct singers");
    expect(guideText).toContain("Title variants");
    expect(guideText).toContain("arranger differences");
    expect(guideText).toContain("Open a match to see who is covering which part");
    expect(guideText).toContain("use Manage to see quartet members");
    expect(guideText).toContain("edit My Songs");
    expect(guideText).toContain("Leaving removes you from the active quartet");
    expect(guideText).toContain("you can rejoin normally");
  });

  it("provides compact table of contents links for every major help section", () => {
    expect(helpNavItems).toEqual([
      { id: "first-time-setup", label: "First time setup" },
      { id: "repertoire", label: "My Songs" },
      { id: "starting-a-quartet", label: "Starting a quartet" },
      { id: "joining-a-quartet", label: "Joining a quartet" },
      { id: "quartet-matches", label: "Quartet matches" },
      { id: "managing-a-quartet", label: "Managing a quartet" },
      { id: "acknowledgments", label: "Acknowledgments" },
      { id: "feedback", label: "Feedback" },
    ]);

    const sectionIds = new Set([
      ...helpGuideSections.map((section) => section.id),
      "acknowledgments",
      "feedback",
    ]);

    for (const item of helpNavItems) {
      expect(sectionIds.has(item.id)).toBe(true);
    }
  });

  it("welcomes general and positive feedback from real singing contexts", () => {
    expect(helpWelcomeCopy).toContain("great time using What Can We Sing");
    expect(helpWelcomeCopy).toContain("convention");
    expect(helpWelcomeCopy).toContain("afterglow");
    expect(helpWelcomeCopy).toContain("Brigade");
    expect(helpFeedbackInvitationCopy).toContain("feedback form");
    expect(feedbackHelpCopy).toContain("just let us know how you are using the app");
    expect(feedbackHelpCopy).toContain("if it helped at a convention");
    expect(feedbackHelpCopy).toContain("General feedback");
  });

  it("includes a modest acknowledgments section for community contributors", () => {
    expect(helpAcknowledgmentsIntro).toContain(
      "people in the barbershop community"
    );
    expect(helpAcknowledgments.map((item) => item.name)).toEqual([
      "Alex Koller",
      "Amber Reimer",
      "Ross Wilkins",
      "Jessica Rodman",
      "Scott Anderson",
      "Marcie Jones and Ann Monaghan McAlexander",
      "Sweet Adelines International",
      "Barbershop Harmony Society",
    ]);
    expect(helpAcknowledgments.map((item) => item.contribution).join(" ")).toContain(
      "Instant Quartet"
    );
    expect(helpAcknowledgments.map((item) => item.contribution).join(" ")).toContain(
      "Event Mode"
    );
    expect(helpAcknowledgments.map((item) => item.contribution).join(" ")).toContain(
      "voicing terminology"
    );
    expect(helpAcknowledgments.map((item) => item.contribution).join(" ")).toContain(
      "sweetadelines.com published and arranged music list PDFs"
    );
    expect(helpAcknowledgments.map((item) => item.contribution).join(" ")).toContain(
      "shop.barbershop.org published music Google sheet"
    );
  });

  it("lists song suggestion sources and a clear AI development note", () => {
    expect(helpSongSuggestionSources.map((item) => item.name)).toEqual([
      "barbershopconnections.com",
      "barbershoptracks.com",
      "gud2brabah.com",
      "Scott Anderson’s International songs list",
      "shop.barbershop.org",
      "sweetadelines.com",
      "timtracks.com",
      "kohlkitzmillermusic.com",
      "melodyhinearrangements.com",
    ]);
    expect(helpSongSuggestionSources.map((item) => item.contribution).join(" ")).toContain(
      "Ross Wilkins’ Harmony Brigade database"
    );
    expect(helpDevelopmentNote).toContain("built by Tim Peterson");
    expect(helpDevelopmentNote).toContain("OpenAI Codex and ChatGPT");
    expect(helpDevelopmentNote).toContain("No OpenAI or other AI product runs inside the app");
    expect(helpDevelopmentNote).not.toContain("Powered by OpenAI");
    expect(helpDevelopmentNote).not.toContain("Built by OpenAI");
  });
});
