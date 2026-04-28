import { describe, expect, it } from "vitest";
import { getPostLoginRedirectPath } from "../authRedirect";

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

  it("does not preserve auth routes as post-login destinations", () => {
    expect(getPostLoginRedirectPath("?redirect=/login")).toBe("/");
    expect(getPostLoginRedirectPath("?redirect=/login?redirect=/join/ABC123")).toBe("/");
    expect(getPostLoginRedirectPath("?redirect=/auth/callback?code=abc")).toBe("/");
    expect(
      getPostLoginRedirectPath(
        "?redirect=/auth/callback&token_hash=abc&type=email"
      )
    ).toBe("/");
  });
});
