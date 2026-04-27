import { describe, expect, it } from "vitest";
import {
  getPostLoginRedirectPath,
  getPostLoginRedirectUrl,
} from "../authRedirect";

describe("login redirects", () => {
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

  it("builds the Supabase email redirect URL from the selected path", () => {
    expect(
      getPostLoginRedirectUrl("http://localhost:3000", "?redirect=/join/ABC123")
    ).toBe("http://localhost:3000/join/ABC123");
  });
});
