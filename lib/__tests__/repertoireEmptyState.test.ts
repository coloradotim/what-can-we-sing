import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("repertoire empty state", () => {
  it("makes Add Song the primary first-run action", () => {
    expect(repertoireManager).toContain("Add your first song");
    expect(repertoireManager).toContain(
      "Song suggestions appear while adding a song"
    );
    expect(repertoireManager).toContain("You can still enter");
    expect(repertoireManager).toContain("Add Song");
  });

  it("does not show active search and filter controls until songs exist", () => {
    expect(repertoireManager).toContain("items.length > 0 &&");
    expect(repertoireManager).toContain("Search my repertoire");
    expect(repertoireManager).toContain("Filter songs you've already added");
    expect(repertoireManager).not.toContain("Search by title");
  });
});
