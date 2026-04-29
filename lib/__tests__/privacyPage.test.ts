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

  it("discloses account, repertoire, quartet, feedback, analytics, and providers", () => {
    expect(privacyPage).toContain("email address");
    expect(privacyPage).toContain("We do not show your email address");
    expect(privacyPage).toContain("song title");
    expect(privacyPage).toContain("parts");
    expect(privacyPage).toContain("confidence");
    expect(privacyPage).toContain("recently sung");
    expect(privacyPage).toContain("participant repertoire snapshots");
    expect(privacyPage).toContain("other singers in that quartet may see");
    expect(privacyPage).toContain("Feedback forms");
    expect(privacyPage).toContain("PostHog");
    expect(privacyPage).toContain("Supabase");
    expect(privacyPage).toContain("Vercel");
    expect(privacyPage).toContain("Resend");
  });

  it("does not overstate analytics or provider privacy", () => {
    expect(privacyPage).toContain("do not intentionally send");
    expect(privacyPage).toContain("may process technical information");
    expect(privacyPage).toContain("We do not sell your data");
  });
});
