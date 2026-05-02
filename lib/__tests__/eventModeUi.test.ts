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
const eventModeSource = readFileSync(
  join(process.cwd(), "lib/eventMode.ts"),
  "utf8"
);

describe("Event Mode UI copy", () => {
  it("uses Event Mode terminology and the requested core actions", () => {
    expect(landingPage).toContain("Event Mode");
    expect(landingPage).toContain("Find my event");
    expect(landingPage).toContain("Create an event");
    expect(landingPage).toContain("Enter with a link or code");
    expect(landingPage).toContain("Use this event");
    expect(detailPage).toContain("Start a quartet");
    expect(detailPage).toContain("I&apos;m available to sing");
    expect(detailPage).toContain("Available singers");
    expect(detailPage).toContain("Turn off my availability");
    expect(detailPage).toContain("Filter by voice part");
    expect(detailPage).toContain("Found people to sing with?");
    expect(detailPage).toContain("Available until");
    expect(eventModeSource).toContain("TTBB Lead");
    expect(eventModeSource).toContain("SSAA Alto 1");
  });

  it("does not introduce deprecated pickup board or location-discovery language", () => {
    const combined = `${landingPage}\n${detailPage}`;

    expect(combined).not.toContain("Pickup Board");
    expect(combined).not.toContain("Create an event board");
    expect(combined).not.toContain("Open event");
    expect(combined).not.toContain("Nearby singers");
    expect(combined).not.toContain("Location discovery");
    expect(combined).not.toContain("Public profile");
    expect(combined).not.toContain("Invite to quartet");
  });
});
