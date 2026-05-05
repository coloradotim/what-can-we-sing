import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const loginPage = readFileSync(join(repoRoot, "app/login/page.tsx"), "utf8");
const repertoireManager = readFileSync(
  join(repoRoot, "components/RepertoireManager.tsx"),
  "utf8"
);
const joinPage = readFileSync(join(repoRoot, "app/join/[code]/page.tsx"), "utf8");
const sharedRepertoireManager = readFileSync(
  join(repoRoot, "components/SharedRepertoireManager.tsx"),
  "utf8"
);
const analytics = readFileSync(join(repoRoot, "lib/analytics.ts"), "utf8");

describe("service failure UI", () => {
  it("uses shared service-limit messaging in login and song flows", () => {
    expect(loginPage).toContain('serviceErrorMessage(error, "auth_email")');
    expect(loginPage).toContain("Wait a minute before requesting another");
    expect(repertoireManager).toContain('serviceErrorMessage(err, "database_read")');
    expect(repertoireManager).toContain('serviceErrorMessage(err, "database_write")');
    expect(sharedRepertoireManager).toContain(
      'serviceErrorMessage(err, "database_write")'
    );
  });

  it("reports partial Harmony Brigade saves and realtime pause state", () => {
    expect(repertoireManager).toContain("added before saving stopped");
    expect(repertoireManager).toContain("Retry the remaining songs");
    expect(joinPage).toContain("liveUpdatesPaused");
    expect(joinPage).toContain("Live updates paused");
    expect(joinPage).toContain("Refresh quartet");
  });

  it("keeps analytics guarded from blocking app flows", () => {
    expect(analytics).toContain("try {");
    expect(analytics).toContain("posthog.capture");
    expect(analytics).toContain("Analytics event failed");
    expect(analytics).toContain("posthog.identify");
    expect(analytics).toContain("posthog.reset");
  });
});
