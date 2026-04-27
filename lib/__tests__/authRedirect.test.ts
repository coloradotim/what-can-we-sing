import { describe, expect, it } from "vitest";
import { getMagicLinkRedirectUrl } from "../authRedirect";

describe("getMagicLinkRedirectUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL when configured", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: "https://what-can-we-sing.vercel.app",
        origin: "http://localhost:3000",
        search: "",
      })
    ).toBe("https://what-can-we-sing.vercel.app/settings");
  });

  it("preserves a safe redirect parameter", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: "https://what-can-we-sing.vercel.app/",
        origin: "http://localhost:3000",
        search: "?redirect=/join/ABC123",
      })
    ).toBe("https://what-can-we-sing.vercel.app/join/ABC123");
  });

  it("falls back to the browser origin for local development", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: undefined,
        origin: "http://localhost:3000",
        search: "",
      })
    ).toBe("http://localhost:3000/settings");
  });

  it("does not fall back to a production browser origin", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: undefined,
        origin: "https://preview.example.com",
        search: "",
      })
    ).toBeNull();
  });

  it("ignores unsafe absolute redirect parameters", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: "https://what-can-we-sing.vercel.app",
        origin: "http://localhost:3000",
        search: "?redirect=https://example.com",
      })
    ).toBe("https://what-can-we-sing.vercel.app/settings");
  });
});
