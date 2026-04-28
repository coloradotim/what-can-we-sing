import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("analytics status route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports safe PostHog configuration status without exposing the key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_public-project-key");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");

    const response = GET();
    const body = await response.json();

    expect(body).toEqual({
      posthogConfigured: true,
      hasPostHogKey: true,
      hasPostHogHost: true,
      posthogHost: "https://us.i.posthog.com",
      vercelEnv: "production",
      gitCommitSha: "abc123",
    });
    expect(JSON.stringify(body)).not.toContain("phc_public-project-key");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reports missing public PostHog variables", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

    const response = GET();
    const body = await response.json();

    expect(body).toMatchObject({
      posthogConfigured: false,
      hasPostHogKey: false,
      hasPostHogHost: false,
      posthogHost: null,
    });
  });
});
