import { describe, expect, it } from "vitest";
import {
  getAuthCallbackNextPath,
  getMagicLinkRedirectUrl,
  getPostLoginRedirectPath,
} from "../authRedirect";

describe("getPostLoginRedirectPath", () => {
  it("defaults post-login redirects to home", () => {
    expect(getPostLoginRedirectPath("")).toBe("/");
  });

  it("preserves a safe redirect query parameter", () => {
    expect(getPostLoginRedirectPath("?redirect=/join/ABC123")).toBe(
      "/join/ABC123"
    );
  });

  it("ignores absolute redirect URLs", () => {
    expect(getPostLoginRedirectPath("?redirect=https://example.com")).toBe("/");
  });

  it("ignores protocol-relative redirect URLs", () => {
    expect(getPostLoginRedirectPath("?redirect=//example.com")).toBe("/");
  });
});

describe("getAuthCallbackNextPath", () => {
  it("defaults callback redirects to home", () => {
    expect(getAuthCallbackNextPath("")).toBe("/");
  });

  it("preserves a safe next query parameter", () => {
    expect(getAuthCallbackNextPath("?next=/join/ABC123")).toBe("/join/ABC123");
  });

  it("ignores unsafe next query parameters", () => {
    expect(getAuthCallbackNextPath("?next=https://example.com")).toBe("/");
    expect(getAuthCallbackNextPath("?next=//example.com")).toBe("/");
  });
});

describe("getMagicLinkRedirectUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL when configured", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: "https://what-can-we-sing.vercel.app",
        origin: "http://localhost:3000",
        search: "",
      })
    ).toBe("https://what-can-we-sing.vercel.app/auth/callback");
  });

  it("passes a safe redirect parameter through the auth callback", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: "https://what-can-we-sing.vercel.app/",
        origin: "http://localhost:3000",
        search: "?redirect=/join/ABC123",
      })
    ).toBe(
      "https://what-can-we-sing.vercel.app/auth/callback?next=%2Fjoin%2FABC123"
    );
  });

  it("falls back to the browser origin for local development", () => {
    expect(
      getMagicLinkRedirectUrl({
        siteUrl: undefined,
        origin: "http://localhost:3000",
        search: "",
      })
    ).toBe("http://localhost:3000/auth/callback");
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
    ).toBe("https://what-can-we-sing.vercel.app/auth/callback");
  });
});
