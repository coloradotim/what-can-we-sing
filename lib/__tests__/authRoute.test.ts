import { describe, expect, it } from "vitest";
import {
  allowsMissingDisplayName,
  getLoginRedirectUrl,
  getSettingsRedirectUrl,
  isPublicAuthPath,
} from "../authRoute";

describe("isPublicAuthPath", () => {
  it("allows the login route", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
  });

  it("allows the privacy route without an auth redirect", () => {
    expect(isPublicAuthPath("/privacy")).toBe(true);
  });

  it("allows help and legacy feedback routes without an auth redirect", () => {
    expect(isPublicAuthPath("/help")).toBe(true);
    expect(isPublicAuthPath("/help/getting-started")).toBe(true);
    expect(isPublicAuthPath("/feedback")).toBe(true);
  });

  it("protects app routes", () => {
    expect(isPublicAuthPath("/songs")).toBe(false);
    expect(isPublicAuthPath("/repertoire")).toBe(false);
    expect(isPublicAuthPath("/join/ABC123")).toBe(false);
    expect(isPublicAuthPath("/auth/callback")).toBe(false);
    expect(isPublicAuthPath("/auth/callback&token_hash=abc&type=signup")).toBe(
      false
    );
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

  it("allows welcome so new users can see quick start before display name setup", () => {
    expect(allowsMissingDisplayName("/welcome")).toBe(true);
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
