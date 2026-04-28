import { describe, expect, it } from "vitest";
import { loginIntro } from "../loginContent";

describe("login intro content", () => {
  it("explains the product before asking new users to sign in", () => {
    const copy = Object.values(loginIntro).join(" ");

    expect(copy).toContain("pickup quartet");
    expect(copy).toContain("what can we sing together right now");
    expect(copy).toContain("songs they know");
    expect(copy).toContain("parts they can sing");
    expect(copy).toContain("Sign in to save your repertoire");
  });
});
