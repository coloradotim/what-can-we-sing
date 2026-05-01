import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("Harmony Brigade repertoire UI", () => {
  it("uses Add Harmony Brigade songs as a compact secondary action", () => {
    expect(repertoireManager).toContain("More ways to build your repertoire");
    expect(repertoireManager).toContain("Copy songs from another singer");
    expect(repertoireManager).toContain(
      "Let another singer copy songs from my repertoire"
    );
    expect(repertoireManager).toContain("Add Harmony Brigade songs");
    expect(repertoireManager).toContain("Choose Brigade songs");
    expect(repertoireManager).toContain("HARMONY_BRIGADE_SOURCE");
  });

  it("keeps the secondary tools compact and collapsible", () => {
    expect(repertoireManager).toContain("aria-controls=\"more-repertoire-tools\"");
    expect(repertoireManager).toContain("id=\"more-repertoire-tools\"");
    expect(repertoireManager).toContain("isMoreWaysOpen &&");
    expect(repertoireManager).toContain("text-base font-bold text-white");
    expect(repertoireManager).toContain("rounded-xl border border-white/10");
  });

  it("uses singer-facing add language instead of import language", () => {
    expect(repertoireManager).toContain("Review songs before adding");
    expect(repertoireManager).toContain(
      "Choose one or more parts for each song you want to add"
    );
    expect(repertoireManager).toContain("Not adding");
    expect(repertoireManager).toContain("part choices");
    expect(repertoireManager).not.toContain("Import Harmony Brigade songs");
    expect(repertoireManager).not.toContain("Apply your part and confidence");
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
