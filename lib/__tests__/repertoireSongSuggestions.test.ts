import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("repertoire song suggestion UI", () => {
  it("keeps catalog suggestions optional and limited", () => {
    expect(repertoireManager).toContain(
      "Start typing to see suggestions, or enter your own song"
    );
    expect(repertoireManager).toContain(
      "No suggestion found. You can still add this song"
    );
    expect(repertoireManager).toContain("setTimeout(async () =>");
    expect(repertoireManager).toContain("}, 250)");
    expect(repertoireManager).toContain("songSuggestionSubtitle");
  });
});
