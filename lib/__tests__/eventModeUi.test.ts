import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const landingPage = readFileSync(
  join(process.cwd(), "app/event-mode/page.tsx"),
  "utf8"
);
const detailPage = readFileSync(
  join(process.cwd(), "app/event-mode/[code]/page.tsx"),
  "utf8"
);
const appNav = readFileSync(join(process.cwd(), "components/AppNav.tsx"), "utf8");
const homePage = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
const eventModeSource = readFileSync(
  join(process.cwd(), "lib/eventMode.ts"),
  "utf8"
);

describe("Event Mode UI copy", () => {
  it("uses Event Mode terminology and the requested core actions", () => {
    expect(landingPage).toContain("Event Mode");
    expect(appNav).toContain('href: "/event-mode"');
    expect(appNav).toContain('label: "Event Mode"');
    expect(homePage).toContain("At a convention, afterglow, or singing event?");
    expect(landingPage).toContain("Find my event");
    expect(landingPage).toContain("Create an event");
    expect(landingPage).toContain('searchParams.get("create") === "1"');
    expect(landingPage).toContain('<AppNav variant="public" />');
    expect(landingPage).toContain("Enter with a link or code");
    expect(landingPage).toContain("Use this event");
    expect(detailPage).toContain("Start a quartet");
    expect(detailPage).toContain("I&apos;m available to sing");
    expect(detailPage).toContain("Available singers");
    expect(detailPage).toContain("Message");
    expect(detailPage).toContain("Send a note to coordinate singing at this");
    expect(detailPage).toContain("Email notification was not sent.");
    expect(detailPage).toContain("Messages");
    expect(detailPage).toContain("Reply");
    expect(detailPage).toContain("Report");
    expect(detailPage).toContain("Block");
    expect(detailPage).toContain("Turn off my availability");
    expect(detailPage).toContain("Filter by voice part");
    expect(detailPage).toContain("Found people to sing with?");
    expect(detailPage).toContain("Available until");
    expect(eventModeSource).toContain("Lower voice (TTBB)");
    expect(eventModeSource).toContain("Treble (SSAA)");
  });

  it("does not introduce deprecated pickup board or location-discovery language", () => {
    const combined = `${landingPage}\n${detailPage}`;

    expect(combined).not.toContain("Pickup Board");
    expect(combined).not.toContain("Create an event board");
    expect(combined).not.toContain("Open event");
    expect(combined).not.toContain("Nearby singers");
    expect(combined).not.toContain("Public chat room");
    expect(combined).not.toContain("Global messaging");
    expect(combined).not.toContain("Location discovery");
    expect(combined).not.toContain("Public profile");
    expect(combined).not.toContain("Invite to quartet");
  });

  it("keeps signed-out Event Mode access explanatory instead of browsable", () => {
    const signedOutBranch = landingPage.slice(
      landingPage.indexOf("if (!signedIn)"),
      landingPage.indexOf("\n\n  return (", landingPage.indexOf("if (!signedIn)"))
    );
    const detailSignedOutBranch = detailPage.slice(
      detailPage.indexOf("{!currentUserId && ("),
      detailPage.indexOf("\n            {currentUserId && (")
    );

    expect(signedOutBranch).toContain("Sign in to find or create an event");
    expect(signedOutBranch).toContain('href="/login?redirect=/event-mode"');
    expect(signedOutBranch).not.toContain("visibleEvents.map");
    expect(detailSignedOutBranch).toContain("Sign in to use this event");
    expect(detailSignedOutBranch).toContain(
      'href={`/login?redirect=/event-mode/${event.join_code}`}'
    );
    expect(detailSignedOutBranch).not.toContain("Available singers");
  });
});
