import { describe, expect, it } from "vitest";

const { transformInternationalSongsCatalog } = await import(
  "../../scripts/import-international-songs.mjs"
);
const { mergeCatalogRows, formatSongSuggestionCatalog } = await import(
  "../../scripts/import-bhs-published-music.mjs"
);
const { parseSongSuggestionCatalog } = await import(
  "../../scripts/import-song-suggestions.mjs"
);

function csv(rows) {
  return [
    "Title,Arranger,Voicing",
    ...rows.map((row) =>
      [row.title ?? "", row.arranger ?? "", row.voicing ?? ""]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    ),
  ].join("\n");
}

describe("International Songs import", () => {
  it("transforms clear source rows into suggestion catalog rows", () => {
    const { rows, report } = transformInternationalSongsCatalog(
      csv([
        {
          title: "A Fool Such As I",
          arranger: "Aaron Dale",
          voicing: "TTBB",
        },
      ])
    );

    expect(report).toMatchObject({
      sourceRows: 1,
      importedRows: 1,
      skippedRows: 0,
      duplicateRows: 0,
    });
    expect(rows).toEqual([
      {
        title: "A Fool Such As I",
        normalized_title: "a fool such as i",
        voicing: "TTBB",
        arranger: "Aaron Dale",
        normalized_arranger: "aaron dale",
        source: "International Songs with Arranger",
      },
    ]);
  });

  it("splits multi-voicing rows into supported app voicings", () => {
    const { rows } = transformInternationalSongsCatalog(
      csv([
        {
          title: "Shared Song",
          arranger: "Shared Arranger",
          voicing: "TTBB, SSAA, SATB",
        },
      ])
    );

    expect(rows.map((row) => row.voicing)).toEqual(["SATB", "SSAA", "TTBB"]);
  });

  it("skips ambiguous or unsupported voicings", () => {
    const { rows, report } = transformInternationalSongsCatalog(
      csv([
        { title: "No Voice", arranger: "A", voicing: "" },
        { title: "Duo Song", arranger: "B", voicing: "Duet" },
        { title: "Mixed Unsupported", arranger: "C", voicing: "TTBB, Duet" },
      ])
    );

    expect(rows).toEqual([]);
    expect(report.reasonCounts).toEqual({
      missing_or_ambiguous_voicing: 1,
      unsupported_or_ambiguous_voicing: 2,
    });
  });

  it("keeps blank arranger and literal Unknown distinct", () => {
    const { rows } = transformInternationalSongsCatalog(
      csv([
        { title: "Mystery Song", arranger: "", voicing: "TTBB" },
        { title: "Mystery Song", arranger: "Unknown", voicing: "TTBB" },
      ])
    );

    expect(rows).toEqual([
      expect.objectContaining({
        arranger: null,
        normalized_arranger: null,
      }),
      expect.objectContaining({
        arranger: "Unknown",
        normalized_arranger: "unknown",
      }),
    ]);
  });

  it("deduplicates source rows and existing catalog rows by normalized key", () => {
    const { rows: importedRows, report } = transformInternationalSongsCatalog(
      csv([
        { title: "Duplicate Song", arranger: "Person", voicing: "TTBB" },
        { title: "Duplicate Song", arranger: "Person", voicing: "ttbb" },
      ])
    );
    const existingRows = parseSongSuggestionCatalog(`Song Title|Voicing|Arranger
Duplicate Song|TTBB|Person
`);
    const merged = mergeCatalogRows(existingRows, importedRows);

    expect(report.duplicateRows).toBe(1);
    expect(importedRows).toHaveLength(1);
    expect(merged.duplicateCount).toBe(1);
    expect(formatSongSuggestionCatalog(merged.rows)).toBe(
      "Song Title|Voicing|Arranger\nDuplicate Song|TTBB|Person\n"
    );
  });
});
