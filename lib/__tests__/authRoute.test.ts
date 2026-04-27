import { describe, expect, it } from "vitest";
import {
  allowsMissingDisplayName,
  getLoginRedirectUrl,
  getNormalizedAuthCallbackUrl,
  getSettingsRedirectUrl,
  isPublicAuthPath,
} from "../authRoute";

describe("isPublicAuthPath", () => {
  it("allows the login route", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
  });

  it("allows the auth callback route", () => {
    expect(isPublicAuthPath("/auth/callback")).toBe(true);
  });

  it("allows malformed auth callback paths so proxy can normalize them", () => {
    expect(isPublicAuthPath("/auth/callback&token_hash=abc&type=signup")).toBe(
      true
    );
  });

  it("allows the privacy route without an auth redirect", () => {
    expect(isPublicAuthPath("/privacy")).toBe(true);
  });

  it("protects app routes", () => {
    expect(isPublicAuthPath("/repertoire")).toBe(false);
    expect(isPublicAuthPath("/join/ABC123")).toBe(false);
  });
});

describe("getNormalizedAuthCallbackUrl", () => {
  it("normalizes callback links that used & before the first query parameter", () => {
    const url = getNormalizedAuthCallbackUrl(
      new URL("https://example.com/auth/callback&token_hash=abc&type=signup")
    );

    expect(url?.toString()).toBe(
      "https://example.com/auth/callback?token_hash=abc&type=signup"
    );
  });

  it("preserves any existing query string while normalizing", () => {
    const url = getNormalizedAuthCallbackUrl(
      new URL("https://example.com/auth/callback&token_hash=abc?type=signup")
    );

    expect(url?.toString()).toBe(
      "https://example.com/auth/callback?token_hash=abc&type=signup"
    );
  });

  it("ignores normal callback paths", () => {
    expect(
      getNormalizedAuthCallbackUrl(
        new URL("https://example.com/auth/callback?token_hash=abc&type=signup")
      )
    ).toBeNull();
  });
});

describe("getLoginRedirectUrl", () => {
  it("redirects root to login without a redirect parameter", () => {
    const url = getLoginRedirectUrl(new URL("https://example.com/"));

    expect(url.toString()).toBe("https://example.com/login");
  });

  it("preserves the intended protected route", () => {
    const url = getLoginRedirectUrl(
      new URL("https://example.com/join/ABC123?foo=bar")
    );

    expect(url.toString()).toBe(
      "https://example.com/login?redirect=%2Fjoin%2FABC123%3Ffoo%3Dbar"
    );
  });
});

describe("allowsMissingDisplayName", () => {
  it("allows settings so users can add their display name", () => {
    expect(allowsMissingDisplayName("/settings")).toBe(true);
  });

  it("does not allow protected app routes", () => {
    expect(allowsMissingDisplayName("/")).toBe(false);
    expect(allowsMissingDisplayName("/session")).toBe(false);
    expect(allowsMissingDisplayName("/join/ABC123")).toBe(false);
  });
});

describe("getSettingsRedirectUrl", () => {
  it("preserves the route the user tried to access", () => {
    const url = getSettingsRedirectUrl(
      new URL("https://example.com/join/ABC123?foo=bar")
    );

    expect(url.toString()).toBe(
      "https://example.com/settings?redirect=%2Fjoin%2FABC123%3Ffoo%3Dbar"
    );
  });

  it("does not create a redirect loop for settings", () => {
    const url = getSettingsRedirectUrl(new URL("https://example.com/settings"));

    expect(url.toString()).toBe("https://example.com/settings");
  });
});
