import { describe, expect, it } from "vitest";

const {
  formatSongSuggestionCatalog,
  mergeCatalogRows,
  transformBhsPublishedMusicCatalog,
} = await import("../../scripts/import-bhs-published-music.mjs");
const { parseSongSuggestionCatalog } = await import(
  "../../scripts/import-song-suggestions.mjs"
);

const header =
  "Product Code/SKU,Product Name,Product Description,Arranger,Difficulty,Ensemble";

function csv(rows) {
  return [
    header,
    ...rows.map((row) =>
      [
        row.sku ?? "",
        row.name,
        row.description ?? "",
        row.arranger ?? "",
        row.difficulty ?? "",
        row.ensemble ?? "",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    ),
  ].join("\n");
}

describe("BHS Published Music import", () => {
  it("uses product description when ensemble is blank", () => {
    const { rows, report } = transformBhsPublishedMusicCatalog(
      csv([
        {
          sku: "100",
          name: "Description Song (TTBB) (arr. Writer)",
          description: "TTBB | Arranged by Full Writer | Available Worldwide",
          arranger: "",
          ensemble: "",
        },
      ])
    );

    expect(report).toMatchObject({
      sourceRows: 1,
      importedRows: 1,
      skippedRows: 0,
    });
    expect(rows).toEqual([
      {
        title: "Description Song",
        normalized_title: "description song",
        voicing: "TTBB",
        arranger: "Full Writer",
        normalized_arranger: "full writer",
        source: "BHS Published Music",
      },
    ]);
  });

  it("prefers explicit product-name voicing over conflicting ensemble values", () => {
    const { rows } = transformBhsPublishedMusicCatalog(
      csv([
        {
          sku: "101",
          name: "Rocky Example (SATB) (arr. Liles)",
          description:
            "SATB, for mixed voices | Arranged by Joe Liles | adapted from the TTBB arrangement",
          arranger: "Joe Liles",
          ensemble: "TTBB",
        },
      ])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].voicing).toBe("SATB");
  });

  it("splits clearly multi-voicing rows into separate catalog rows", () => {
    const { rows } = transformBhsPublishedMusicCatalog(
      csv([
        {
          sku: "102",
          name: "Multi Voicing Song (TTBB/SSAA) (arr. Singer)",
          description: "TTBB/SSAA | Arranged by Shared Singer",
          arranger: "Shared Singer",
          ensemble: "",
        },
      ])
    );

    expect(rows.map((row) => row.voicing)).toEqual(["SSAA", "TTBB"]);
    expect(rows.map((row) => row.title)).toEqual([
      "Multi Voicing Song",
      "Multi Voicing Song",
    ]);
  });

  it("skips ambiguous and non-four-part products", () => {
    const { rows, report } = transformBhsPublishedMusicCatalog(
      csv([
        {
          sku: "103",
          name: "No Voicing Song",
          description: "Arranged by Someone | Available Worldwide",
          arranger: "Someone",
          ensemble: "",
        },
        {
          sku: "104",
          name: "Barberpole Cat Songbook Vol. I - Print",
          description: "TTBB | Songbook collection",
          arranger: "",
          ensemble: "",
        },
        {
          sku: "105",
          name: "Eight Part Song (8-Part M/W) (arr. Person)",
          description: "Mixed Double Quartet (SSAA/TTBB) | Arranged by Person",
          arranger: "Person",
          ensemble: "",
        },
      ])
    );

    expect(rows).toEqual([]);
    expect(report.reasonCounts).toEqual({
      missing_or_ambiguous_voicing: 1,
      non_four_part_or_collection: 2,
    });
  });

  it("keeps blank arranger and literal Unknown distinct", () => {
    const { rows } = transformBhsPublishedMusicCatalog(
      csv([
        {
          sku: "106",
          name: "Known Unknown (TTBB)",
          description: "TTBB",
          arranger: "",
          ensemble: "",
        },
        {
          sku: "107",
          name: "Known Unknown (TTBB)",
          description: "TTBB",
          arranger: "Unknown",
          ensemble: "",
        },
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

  it("deduplicates BHS variants and existing catalog rows by normalized key", () => {
    const { rows: bhsRows, report } = transformBhsPublishedMusicCatalog(
      csv([
        {
          sku: "108-print",
          name: "Duplicate Song (SSAA) (arr. Person)",
          description: "SSAA | Arranged by Person | Print version",
          arranger: "Person",
          ensemble: "",
        },
        {
          sku: "108-download",
          name: "Duplicate Song (SSAA) (arr. Person)",
          description: "SSAA | Arranged by Person | Download version",
          arranger: "Person",
          ensemble: "",
        },
      ])
    );
    const existingRows = parseSongSuggestionCatalog(`Song Title|Voicing|Arranger
Duplicate Song|SSAA|Person
`);
    const merged = mergeCatalogRows(existingRows, bhsRows);

    expect(report.duplicateRows).toBe(1);
    expect(bhsRows).toHaveLength(1);
    expect(merged.duplicateCount).toBe(1);
    expect(formatSongSuggestionCatalog(merged.rows)).toBe(
      "Song Title|Voicing|Arranger\nDuplicate Song|SSAA|Person\n"
    );
  });
});
