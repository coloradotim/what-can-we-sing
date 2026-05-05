import { describe, expect, it } from "vitest";
import { formatSourcePsv } from "../../scripts/song-sources/psv.mjs";
import {
  parseMelodyHineProduct,
  transformMelodyHineCandidate,
  transformMelodyHineProducts,
} from "../../scripts/song-sources/scrape-melody-hine-arrangements.mjs";

describe("Melody Hine Arrangements source scraper transforms", () => {
  it("maps source voicing categories to app voicings", () => {
    expect(
      parseMelodyHineProduct({
        link: "https://melodyhinearrangements.com/?product=example-upper",
        title: { rendered: "Example Song &#8211; Barbershop Upper Voices" },
        product_cat: [57, 33],
      }).candidate
    ).toEqual({
      sourceUrl: "https://melodyhinearrangements.com/?product=example-upper",
      title: "Example Song",
      voicingText: "Upper Voices",
      arranger: "Melody Hine",
    });

    expect(
      transformMelodyHineProducts([
        {
          link: "https://melodyhinearrangements.com/?product=example-upper",
          title: { rendered: "Example Song &#8211; Barbershop Upper Voices" },
          product_cat: [57, 33],
        },
        {
          link: "https://melodyhinearrangements.com/?product=example-mixed",
          title: { rendered: "Example Song &#8211; Barbershop Mixed Voices" },
          product_cat: [57, 65],
        },
        {
          link: "https://melodyhinearrangements.com/?product=example-lower",
          title: { rendered: "Example Song &#8211; Barbershop Lower Voices" },
          product_cat: [57, 40],
        },
      ]).rows.map((row) => row.voicing)
    ).toEqual(["SATB", "SSAA", "TTBB"]);
  });

  it("does not require a contest category when voicing is clear", () => {
    expect(
      parseMelodyHineProduct({
        link: "https://melodyhinearrangements.com/?product=example",
        title: { rendered: "Example Song &#8211; Barbershop Lower Voices" },
        product_cat: [40],
      }).candidate
    ).toMatchObject({
      title: "Example Song",
      voicingText: "Lower Voices",
      arranger: "Melody Hine",
    });
  });

  it("skips rows without confident voicing", () => {
    expect(
      transformMelodyHineCandidate({
        title: "No Voicing",
        arranger: "Melody Hine",
        voicingText: "",
      }).skipped.reason
    ).toBe("missing_voicing");

    expect(
      transformMelodyHineCandidate({
        title: "Unknown Voicing",
        arranger: "Melody Hine",
        voicingText: "Youth",
      }).skipped.reason
    ).toBe("unknown_voicing");
  });

  it("dedupes repeated products while preserving distinct voicings", () => {
    const transformed = transformMelodyHineProducts([
      {
        link: "https://melodyhinearrangements.com/?product=where-i-wanna-be",
        title: { rendered: "Where I Wanna Be &#8211; Barbershop Mixed Voices" },
        product_cat: [57, 65],
      },
      {
        link: "https://melodyhinearrangements.com/?product=where-i-wanna-be-2",
        title: { rendered: "Where I Wanna Be &#8211; Barbershop Mixed Voices" },
        product_cat: [57, 65],
      },
      {
        link: "https://melodyhinearrangements.com/?product=where-i-wanna-be-lower",
        title: { rendered: "Where I Wanna Be &#8211; Barbershop Lower Voices" },
        product_cat: [57, 40],
      },
    ]);

    expect(transformed.report.duplicateRows).toBe(1);
    expect(transformed.rows).toEqual([
      {
        title: "Where I Wanna Be",
        voicing: "SATB",
        arranger: "Melody Hine",
        source: "Melody Hine Arrangements",
      },
      {
        title: "Where I Wanna Be",
        voicing: "TTBB",
        arranger: "Melody Hine",
        source: "Melody Hine Arrangements",
      },
    ]);
  });

  it("normalizes bundle and learning-track labels from titles", () => {
    expect(
      parseMelodyHineProduct({
        link: "https://melodyhinearrangements.com/?product=collection-upper",
        title: { rendered: "Public Domain Collection &#8211; Upper Voices Bundle" },
        product_cat: [57, 33],
      }).candidate.title
    ).toBe("Public Domain Collection");

    expect(
      parseMelodyHineProduct({
        link: "https://melodyhinearrangements.com/?product=avalon-learning-tracks",
        title: {
          rendered: "Avalon Learning Tracks &#8211; Barbershop Youth Mixed Voices",
        },
        product_cat: [57, 65, 49],
      }).candidate.title
    ).toBe("Avalon");
  });

  it("replaces pipes before PSV writing", () => {
    const transformed = transformMelodyHineCandidate({
      title: "Pipe | Song",
      voicingText: "Lower Voices",
      arranger: "Melody | Hine",
    });

    expect(formatSourcePsv(transformed.rows)).toContain(
      "Pipe / Song|TTBB|Melody / Hine"
    );
  });
});
