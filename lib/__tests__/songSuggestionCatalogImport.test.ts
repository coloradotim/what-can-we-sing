import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const {
  normalizeSearchText,
  parseSongSuggestionCatalog,
} = await import("../../scripts/import-song-suggestions.mjs");

const catalogSource = readFileSync(
  join(process.cwd(), "data/song_suggestion_catalog.psv"),
  "utf8"
);

describe("song suggestion catalog import", () => {
  it("normalizes search text like the database RPC", () => {
    expect(normalizeSearchText("  The End of the World! ")).toBe(
      "the end of the world"
    );
    expect(normalizeSearchText("Mam'selle")).toBe("mam selle");
  });

  it("parses and deduplicates pipe-delimited catalog rows", () => {
    const rows = parseSongSuggestionCatalog(`Song Title|Voicing|Arranger
The End of the World|TTBB|Hilary Allen
The End of the World|TTBB|Hilary Allen
A Winter's Tale|SSAA|Hilary Allen
No Arranger Song|TTBB|
`);

    expect(rows).toEqual([
      {
        title: "A Winter's Tale",
        normalized_title: "a winter s tale",
        voicing: "SSAA",
        arranger: "Hilary Allen",
        normalized_arranger: "hilary allen",
        source: "Barbershop Connections",
      },
      {
        title: "No Arranger Song",
        normalized_title: "no arranger song",
        voicing: "TTBB",
        arranger: null,
        normalized_arranger: null,
        source: "Barbershop Connections",
      },
      {
        title: "The End of the World",
        normalized_title: "the end of the world",
        voicing: "TTBB",
        arranger: "Hilary Allen",
        normalized_arranger: "hilary allen",
        source: "Barbershop Connections",
      },
    ]);
  });

  it("keeps the generated catalog source in the expected format", () => {
    expect(catalogSource.startsWith("Song Title|Voicing|Arranger\n")).toBe(true);
    const parsedRows = parseSongSuggestionCatalog(catalogSource);

    expect(parsedRows.length).toBeGreaterThan(1000);
    expect(parsedRows[0]).toHaveProperty("title");
    expect(parsedRows[0]).toHaveProperty("voicing");
    expect(parsedRows[0]).toHaveProperty("normalized_title");
  });
});
