import { describe, expect, it } from "vitest";
import { formatSourcePsv } from "../../scripts/song-sources/psv.mjs";
import {
  parseKohlKitzmillerProductSlug,
  parseKohlKitzmillerProductTitle,
  transformKohlKitzmillerCandidate,
  transformKohlKitzmillerProducts,
} from "../../scripts/song-sources/scrape-kohl-kitzmiller-music.mjs";

describe("Kohl Kitzmiller Music source scraper transforms", () => {
  it("normalizes explicit supported voicings", () => {
    expect(
      transformKohlKitzmillerCandidate({
        title: "Example TTBB",
        voicingText: "TTBB",
        arranger: "Kohl Kitzmiller",
      }).rows
    ).toEqual([
      {
        title: "Example TTBB",
        voicing: "TTBB",
        arranger: "Kohl Kitzmiller",
        source: "Kohl Kitzmiller Music",
      },
    ]);
    expect(
      transformKohlKitzmillerCandidate({
        title: "Example SSAA",
        voicingText: "Women's",
        arranger: "Kohl Kitzmiller",
      }).rows[0].voicing
    ).toBe("SSAA");
    expect(
      transformKohlKitzmillerCandidate({
        title: "Example SATB",
        voicingText: "Mixed",
        arranger: "Kohl Kitzmiller",
      }).rows[0].voicing
    ).toBe("SATB");
  });

  it("splits multi-voicing rows", () => {
    expect(
      transformKohlKitzmillerCandidate({
        title: "Multi Song",
        voicingText: "TTBB, SSAA, SATB",
        arranger: "Name One",
      }).rows.map((row) => row.voicing)
    ).toEqual(["TTBB", "SSAA", "SATB"]);
  });

  it("skips rows without confident arranger or voicing", () => {
    expect(
      transformKohlKitzmillerCandidate({
        title: "Missing Arranger",
        voicingText: "TTBB",
        arranger: "",
      }).skipped.reason
    ).toBe("missing_arranger");
    expect(
      transformKohlKitzmillerCandidate({
        title: "Missing Voicing",
        voicingText: "",
        arranger: "Someone",
      }).skipped.reason
    ).toBe("missing_voicing");
    expect(
      transformKohlKitzmillerCandidate({
        title: "Unknown Voicing",
        voicingText: "SSAATTBB",
        arranger: "Someone",
      }).skipped.reason
    ).toBe("unknown_voicing");
  });

  it("normalizes trailing articles and arranger separators", () => {
    expect(
      transformKohlKitzmillerCandidate({
        title: "Closest Thing To Crazy, The",
        voicingText: "TTBB",
        arranger: "Name One; Name Two & Name Three",
      }).rows
    ).toEqual([
      {
        title: "The Closest Thing To Crazy",
        voicing: "TTBB",
        arranger: "Name One, Name Two and Name Three",
        source: "Kohl Kitzmiller Music",
      },
    ]);
  });

  it("dedupes exact rows while preserving different voicing and arranger", () => {
    const transformed = transformKohlKitzmillerProducts([
      "https://kohlkitzmillermusic.com/product/same-song-ttbb-arr-name-one-learning-tracks/",
      "https://kohlkitzmillermusic.com/product/same-song-ttbb-arr-name-one-full-mix/",
      "https://kohlkitzmillermusic.com/product/same-song-ssaa-arr-name-one-learning-tracks/",
      "https://kohlkitzmillermusic.com/product/same-song-ttbb-arr-name-two-learning-tracks/",
    ]);

    expect(transformed.report.duplicateRows).toBe(1);
    expect(transformed.rows).toEqual([
      {
        title: "Same Song",
        voicing: "SSAA",
        arranger: "Name One",
        source: "Kohl Kitzmiller Music",
      },
      {
        title: "Same Song",
        voicing: "TTBB",
        arranger: "Name One",
        source: "Kohl Kitzmiller Music",
      },
      {
        title: "Same Song",
        voicing: "TTBB",
        arranger: "Name Two",
        source: "Kohl Kitzmiller Music",
      },
    ]);
  });

  it("replaces pipes before PSV writing", () => {
    const transformed = transformKohlKitzmillerCandidate({
      title: "Pipe | Song",
      voicingText: "TTBB",
      arranger: "Arranger | Name",
    });

    expect(formatSourcePsv(transformed.rows)).toContain(
      "Pipe / Song|TTBB|Arranger / Name"
    );
  });

  it("parses sitemap product slugs conservatively", () => {
    expect(
      parseKohlKitzmillerProductSlug(
        "https://kohlkitzmillermusic.com/product/they-just-keep-moving-the-line-satb-arr-kohl-kitzmiller-learning-tracks/"
      ).candidate
    ).toEqual({
      sourceUrl:
        "https://kohlkitzmillermusic.com/product/they-just-keep-moving-the-line-satb-arr-kohl-kitzmiller-learning-tracks/",
      title: "They Just Keep Moving The Line",
      voicingText: "SATB",
      arranger: "Kohl Kitzmiller",
    });
    expect(
      parseKohlKitzmillerProductSlug(
        "https://kohlkitzmillermusic.com/product/paralyzed-learning-track-satb-arr-brian-mastrull/"
      ).candidate
    ).toMatchObject({
      title: "Paralyzed",
      voicingText: "SATB",
      arranger: "Brian Mastrull",
    });
    expect(
      parseKohlKitzmillerProductSlug(
        "https://kohlkitzmillermusic.com/product/wellerman-ttbb-authorized-for-use-by-example-4-copies/"
      ).skipped.reason
    ).toBe("private_authorized_copy");
  });

  it("prefers product API titles when available", () => {
    expect(
      parseKohlKitzmillerProductTitle({
        link: "https://kohlkitzmillermusic.com/product/you-can-sing-well-joey-buss-ttbb-arr-theodore-hicks-learning-tracks/",
        title: {
          rendered:
            "You Can Sing Well, Joey Buss! (TTBB) arr. Theodore Hicks &#8211; Learning Tracks",
        },
      }).candidate
    ).toEqual({
      sourceUrl:
        "https://kohlkitzmillermusic.com/product/you-can-sing-well-joey-buss-ttbb-arr-theodore-hicks-learning-tracks/",
      title: "You Can Sing Well, Joey Buss!",
      voicingText: "TTBB",
      arranger: "Theodore Hicks",
    });
    expect(
      parseKohlKitzmillerProductTitle({
        link: "https://kohlkitzmillermusic.com/product/paralyzed-learning-track-satb-arr-brian-mastrull/",
        title: {
          rendered: "Paralyzed - Learning Track (SATB) - Arr. Brian Mastrull",
        },
      }).candidate
    ).toMatchObject({
      title: "Paralyzed",
      voicingText: "SATB",
      arranger: "Brian Mastrull",
    });
  });
});
