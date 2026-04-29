import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const appNav = readFileSync(join(repoRoot, "components/AppNav.tsx"), "utf8");
const publicAwareAppNav = readFileSync(
  join(repoRoot, "components/PublicAwareAppNav.tsx"),
  "utf8"
);
const helpPage = readFileSync(join(repoRoot, "app/help/page.tsx"), "utf8");
const privacyPage = readFileSync(
  join(repoRoot, "app/privacy/page.tsx"),
  "utf8"
);

describe("public page navigation", () => {
  it("has a public AppNav variant with a login action and no quartet widget", () => {
    const publicVariant = appNav.slice(
      appNav.indexOf('if (variant === "public")'),
      appNav.indexOf("\n\n  return (", appNav.indexOf('if (variant === "public")'))
    );

    expect(appNav).toContain('variant?: "app" | "public"');
    expect(publicVariant).toContain('href="/login"');
    expect(publicVariant).toContain("Log in or sign up");
    expect(publicVariant).not.toContain("ActiveQuartetIndicator");
  });

  it("defaults public pages to public navigation until a signed-in user is confirmed", () => {
    expect(publicAwareAppNav).toContain("getCurrentUser");
    expect(publicAwareAppNav).toContain(
      '<AppNav variant={isSignedIn ? "app" : "public"} />'
    );
    expect(helpPage).toContain("<PublicAwareAppNav />");
    expect(privacyPage).toContain("<PublicAwareAppNav />");
  });
});
