import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("Harmony Brigade repertoire UI", () => {
  it("uses Add Harmony Brigade songs as a secondary repertoire action", () => {
    expect(repertoireManager).toContain("More ways to build your repertoire");
    expect(repertoireManager).toContain("Add Harmony Brigade songs");
    expect(repertoireManager).toContain("Copy songs from another singer");
    expect(repertoireManager).toContain(
      "Let another singer copy songs from my repertoire"
    );
    expect(repertoireManager).toContain("Source: {HARMONY_BRIGADE_SOURCE}.");
  });

  it("uses singer-facing add language instead of import language", () => {
    expect(repertoireManager).toContain("Review songs before adding");
    expect(repertoireManager).toContain("Apply your part and confidence");
    expect(repertoireManager).toContain("Add selected songs");
    expect(repertoireManager).not.toContain("Import Harmony Brigade songs");
  });

  it("keeps Brigade songs out of normal typeahead suggestions", () => {
    expect(repertoireManager).toContain("searchRepertoireSongSuggestions");
    expect(repertoireManager).toContain("harmonyBrigadeSearchQuery");
    expect(repertoireManager).not.toContain(
      "searchHarmonyBrigadeCandidates(songSuggestions"
    );
    expect(repertoireManager).not.toContain(
      "searchRepertoireSongSuggestions(harmonyBrigadeSearchQuery"
    );
  });
});
