import { describe, expect, it } from "vitest";
import { getLoginRedirectUrl, isPublicAuthPath } from "../authRoute";

describe("isPublicAuthPath", () => {
  it("allows the login route", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
  });

  it("protects app routes", () => {
    expect(isPublicAuthPath("/repertoire")).toBe(false);
    expect(isPublicAuthPath("/join/ABC123")).toBe(false);
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
