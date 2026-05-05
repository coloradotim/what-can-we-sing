import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const appNav = readFileSync(join(repoRoot, "components/AppNav.tsx"), "utf8");
const homePage = readFileSync(join(repoRoot, "app/page.tsx"), "utf8");
const songsPage = readFileSync(join(repoRoot, "app/songs/page.tsx"), "utf8");
const repertoirePage = readFileSync(
  join(repoRoot, "app/repertoire/page.tsx"),
  "utf8"
);

describe("canonical My Songs route", () => {
  it("serves My Songs at /songs and redirects the legacy repertoire route", () => {
    expect(songsPage).toContain("function SongsPage");
    expect(songsPage).toContain("<RepertoireManager />");
    expect(repertoirePage).toContain('redirect("/songs")');
  });

  it("uses /songs for user-facing My Songs navigation", () => {
    expect(appNav).toContain('href: "/songs"');
    expect(appNav).toContain('pathname === "/songs"');
    expect(appNav).toContain('pathname === "/repertoire"');
    expect(homePage).toContain('href: "/songs"');
    expect(homePage).not.toContain('href: "/repertoire"');
  });
});
