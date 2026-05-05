import { describe, expect, it } from "vitest";
import { formatSourcePsv } from "../../scripts/song-sources/psv.mjs";
import {
  parseSheetMusicPlusProduct,
  productUrlsFromSearchPage,
  transformSheetMusicPlusProducts,
} from "../../scripts/song-sources/import-sheet-music-plus-barbershop.mjs";

const ttbbProductText = `
One More Time TTBB - Digital Sheet Music

Details
Instrument:
Voice
Ensembles:
TTBB 4-Part
Genres:
Barbershop
Publishers:
Keep Singing
Series:
ArrangeMe
Detailed Description
Voice (TTBB) - Level 2 - Digital Download
SKU: A0.674449
Composed by James Wiggins. Arranged by James Wiggins. This edition: pdf. Barbershop. Barbershop Quartet. 4 pages.
`;

const jinaProductText = `
Title: One More Time - Voice, TTBB, 4-Part - Early Intermediate Digital Sheet Music | Sheet Music Plus

# One More Time - Voice, TTBB, 4-Part - Early Intermediate Digital Sheet Music | Sheet Music Plus

# One More Time  TTBB - Digital Sheet Music

Details
Instrument: Voice
Ensembles: TTBB 4-Part
Genres: Barbershop
Publishers: Keep Singing
Series: ArrangeMe

Detailed Description
Voice (TTBB) - Level 2 - Digital Download

Composed by James Wiggins. Arranged by James Wiggins. This edition: pdf. Barbershop. Barbershop Quartet. 4 pages.
`;

describe("Sheet Music Plus source importer transforms", () => {
  it("extracts confident title, voicing, and arranger rows", () => {
    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText,
        sourceUrl: "https://www.sheetmusicplus.com/en/product/one-more-time-22224033.html",
      }).rows
    ).toEqual([
      {
        title: "One More Time",
        voicing: "TTBB",
        arranger: "James Wiggins",
        source: "Sheet Music Plus Barbershop catalog",
      },
    ]);
  });

  it("extracts rows from text-rendered product markdown", () => {
    expect(
      parseSheetMusicPlusProduct({
        text: jinaProductText,
        sourceUrl: "https://www.sheetmusicplus.com/en/product/one-more-time-22224033.html",
      }).rows
    ).toEqual([
      {
        title: "One More Time",
        voicing: "TTBB",
        arranger: "James Wiggins",
        source: "Sheet Music Plus Barbershop catalog",
      },
    ]);
  });

  it("removes marketplace descriptors from rendered titles", () => {
    const transformed = transformSheetMusicPlusProducts([
      {
        text: jinaProductText
          .replaceAll("One More Time", "Paper Doll, Vocal Score (Barbershop Quartet) - Choir, Voice,")
          .replaceAll("James Wiggins", "Carol Conrad"),
      },
      {
        text: jinaProductText
          .replaceAll("One More Time", "Pinin' Just For You - Men's Barbershop Arrangement")
          .replaceAll("James Wiggins", "Brian Cromer"),
      },
      {
        text: jinaProductText
          .replaceAll("One More Time", "Hark! The Herald Angels Sing, Women's Barbershop")
          .replaceAll("James Wiggins", "Dianne Goldrick"),
      },
      {
        text: jinaProductText
          .replaceAll("One More Time", "Ring Christmas Bells for Female Barbershop")
          .replaceAll("James Wiggins", "Kim Kirkman"),
      },
    ]);

    expect(transformed.rows.map((row) => row.title)).toEqual([
      "Hark! The Herald Angels Sing",
      "Paper Doll",
      "Pinin' Just For You",
      "Ring Christmas Bells",
    ]);
  });

  it("discovers product links from rendered markdown and direct html", () => {
    expect(
      productUrlsFromSearchPage(`
        [One More Time](https://www.sheetmusicplus.com/en/product/one-more-time-22224033.html)
        <a href="/en/product/barbershop-blues-820685.html">Barbershop Blues</a>
      `)
    ).toEqual([
      "https://www.sheetmusicplus.com/en/product/barbershop-blues-820685.html",
      "https://www.sheetmusicplus.com/en/product/one-more-time-22224033.html",
    ]);
  });

  it("assigns only canonical voicing values", () => {
    expect(
      transformSheetMusicPlusProducts([
        {
          text: ttbbProductText.replaceAll("TTBB", "SSAA").replace(
            "Voice (SSAA)",
            "Voice (SSAA)"
          ),
        },
        {
          text: ttbbProductText.replaceAll("TTBB", "SATB").replace(
            "Voice (SATB)",
            "Voice (SATB)"
          ),
        },
      ]).rows.map((row) => row.voicing)
    ).toEqual(["SATB", "SSAA"]);
  });

  it("skips missing or ambiguous arranger and voicing rows", () => {
    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText.replace("Arranged by James Wiggins.", ""),
      }).skipped.reason
    ).toBe("missing_arranger");

    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText.replaceAll("TTBB", "Voice"),
      }).skipped.reason
    ).toBe("missing_voicing");

    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText.replace("TTBB 4-Part", "TTBB 4-Part SSAA 4-Part"),
      }).skipped.reason
    ).toBe("ambiguous_voicing");
  });

  it("skips collection and non-barbershop products", () => {
    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText.replace("One More Time", "15 Barbershop Favorites"),
      }).skipped.reason
    ).toBe("collection_or_book");

    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText.replaceAll("Barbershop", "Classical"),
      }).skipped.reason
    ).toBe("non_barbershop_product");
  });

  it("ignores recommendation text when deciding if a product is barbershop", () => {
    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText
          .replace("One More Time TTBB - Digital Sheet Music", "Solo Violin - Digital Sheet Music")
          .replace("TTBB 4-Part", "Violin")
          .replace("Voice (TTBB)", "Violin")
          .replaceAll("Barbershop", "Classical") +
          "\n\n## You may also like\n[Barbershop Quartet](https://example.com)",
      }).skipped.reason
    ).toBe("non_barbershop_product");
  });

  it("skips source collections and placeholder arrangers", () => {
    expect(
      parseSheetMusicPlusProduct({
        text:
          ttbbProductText.replace("One More Time", "Nashville: Barbershop Style") +
          "\nFormat: Collection / Songbook\nArranged by Various.",
      }).skipped.reason
    ).toBe("collection_or_book");

    expect(
      parseSheetMusicPlusProduct({
        text: ttbbProductText.replaceAll("James Wiggins", "Various"),
      }).skipped.reason
    ).toBe("placeholder_arranger");
  });

  it("dedupes exact rows while preserving distinct arrangers", () => {
    const transformed = transformSheetMusicPlusProducts([
      { text: ttbbProductText },
      { text: ttbbProductText },
      { text: ttbbProductText.replaceAll("James Wiggins", "Name Two") },
    ]);

    expect(transformed.report.duplicateRows).toBe(1);
    expect(transformed.rows).toEqual([
      {
        title: "One More Time",
        voicing: "TTBB",
        arranger: "James Wiggins",
        source: "Sheet Music Plus Barbershop catalog",
      },
      {
        title: "One More Time",
        voicing: "TTBB",
        arranger: "Name Two",
        source: "Sheet Music Plus Barbershop catalog",
      },
    ]);
  });

  it("writes the shared PSV header and escapes pipes", () => {
    const transformed = parseSheetMusicPlusProduct({
      text: ttbbProductText
        .replace("One More Time", "One | More Time")
        .replaceAll("James Wiggins", "James | Wiggins"),
    });

    expect(formatSourcePsv(transformed.rows)).toContain(
      "Song Title|Voicing|Arranger\nOne / More Time|TTBB|James / Wiggins"
    );
  });
});
