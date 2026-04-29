import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loginIntro } from "../loginContent";

const loginPage = readFileSync(join(process.cwd(), "app/login/page.tsx"), "utf8");

describe("login intro content", () => {
  it("explains the product before asking new users to sign in", () => {
    const copy = Object.values(loginIntro).join(" ");

    expect(copy).toContain("pickup quartet");
    expect(copy).toContain("what can we sing together right now");
    expect(copy).toContain("songs they know");
    expect(copy).toContain("parts they can sing");
    expect(copy).toContain("Sign in to save your repertoire");
  });

  it("links new users to help before they sign in", () => {
    expect(loginPage).toContain('href="/help"');
    expect(loginPage).toContain("Read how the app works");
  });
});
