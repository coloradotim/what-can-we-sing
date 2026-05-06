import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const privacyPage = readFileSync(
  join(process.cwd(), "app/privacy/page.tsx"),
  "utf8"
);

describe("privacy page copy", () => {
  it("uses auth-aware public navigation", () => {
    expect(privacyPage).toContain('import { PublicAwareAppNav }');
    expect(privacyPage).toContain("<PublicAwareAppNav />");
  });

  it("discloses account, My Songs, quartet, feedback, analytics, and providers", () => {
    expect(privacyPage).toContain("email address");
    expect(privacyPage).toContain("We do not show your email address");
    expect(privacyPage).toContain("The songs you add");
    expect(privacyPage).toContain("song title");
    expect(privacyPage).toContain("parts");
    expect(privacyPage).toContain("confidence");
    expect(privacyPage).toContain("Last-sung data");
    expect(privacyPage).toContain("participant saved-song snapshots");
    expect(privacyPage).toContain("Private copy links");
    expect(privacyPage).toContain("Harmony Brigade songs");
    expect(privacyPage).toContain("Event Mode Beta");
    expect(privacyPage).toContain("beta feature");
    expect(privacyPage).toContain("Listed events can be");
    expect(privacyPage).toContain("unlisted events require a link or");
    expect(privacyPage).toContain("Availability is opt-in");
    expect(privacyPage).toContain("Voice parts, availability notes, and meetup notes");
    expect(privacyPage).toContain("does not use GPS or");
    expect(privacyPage).toContain("exact location tracking");
    expect(privacyPage).toContain("does not expose your My Songs repertoire");
    expect(privacyPage).toContain("event-scoped messages");
    expect(privacyPage).toContain("email notification");
    expect(privacyPage).toContain("message text or sender contact details");
    expect(privacyPage).toContain("message reports");
    expect(privacyPage).toContain("blocks");
    expect(privacyPage).toContain("other singers in that quartet may see");
    expect(privacyPage).toContain("Feedback forms");
    expect(privacyPage).toContain("PostHog");
    expect(privacyPage).toContain("Supabase");
    expect(privacyPage).toContain("Vercel");
    expect(privacyPage).toContain("Resend");
    expect(privacyPage).not.toContain("Your My Songs entries");
    expect(privacyPage).not.toContain("manage My Songs");
    expect(privacyPage).not.toContain("their own My Songs entries");
  });

  it("does not overstate analytics or provider privacy", () => {
    expect(privacyPage).toContain("do not intentionally send");
    expect(privacyPage).toContain("may process technical information");
    expect(privacyPage).toContain("We do not sell your data");
  });
});
