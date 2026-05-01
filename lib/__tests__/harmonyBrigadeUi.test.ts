import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("Harmony Brigade repertoire UI backout", () => {
  it("removes the incomplete Harmony Brigade add flow from secondary actions", () => {
    expect(repertoireManager).toContain("More ways to build your repertoire");
    expect(repertoireManager).toContain("Copy songs from another singer");
    expect(repertoireManager).toContain(
      "Let another singer copy songs from my repertoire"
    );
    expect(repertoireManager).not.toContain("Choose Brigade event");
    expect(repertoireManager).not.toContain("Add Harmony Brigade songs");
    expect(repertoireManager).not.toContain("Harmony Brigade event");
    expect(repertoireManager).not.toContain("HARMONY_BRIGADE_SOURCE");
  });

  it("keeps the secondary tools compact and collapsible", () => {
    expect(repertoireManager).toContain("aria-controls=\"more-repertoire-tools\"");
    expect(repertoireManager).toContain("id=\"more-repertoire-tools\"");
    expect(repertoireManager).toContain("isMoreWaysOpen &&");
    expect(repertoireManager).toContain("text-base font-bold text-white");
    expect(repertoireManager).toContain("rounded-xl border border-white/10");
  });

  it("does not expose the removed Brigade picker language", () => {
    expect(repertoireManager).not.toContain("Review songs before adding");
    expect(repertoireManager).not.toContain("Apply your part and confidence");
    expect(repertoireManager).not.toContain("Add selected songs");
    expect(repertoireManager).not.toContain("Import Harmony Brigade songs");
  });

  it("keeps the normal typeahead path independent of removed Brigade data", () => {
    expect(repertoireManager).toContain("searchRepertoireSongSuggestions");
    expect(repertoireManager).not.toContain("harmonyBrigadeSearchQuery");
    expect(repertoireManager).not.toContain(
      "searchHarmonyBrigadeCandidates(songSuggestions"
    );
    expect(repertoireManager).not.toContain(
      "searchRepertoireSongSuggestions(harmonyBrigadeSearchQuery"
    );
  });
});
