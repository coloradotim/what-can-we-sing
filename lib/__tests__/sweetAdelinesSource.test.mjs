import { describe, expect, it } from "vitest";
import { formatSourcePsv } from "../../scripts/song-sources/psv.mjs";
import { defaultSourcePaths } from "../../scripts/merge-song-suggestion-sources.mjs";
import {
  normalizeSweetAdelinesTitle,
  parseSweetAdelinesPublishedMusicText,
} from "../../scripts/song-sources/import-sweet-adelines-published-music.mjs";

const fixtureText = `
1
ID# SONG TITLE TYPE DIFFICULTY
LEVEL ARRANGER
SWEET ADELINES INTERNATIONAL PUBLISHED MUSIC
MA0081 A COTTAGE FOR SALE Ballad M Sharon Holmes
MS0410 BEST OF TIMES, THE Uptune M Tedda Lippincott
MS10024 SEASONS OF LOVE Joey Minshall & Carolyn Schmidt
MS5401 YW - STAR SPANGLED BANNER (SSAA) FREE
DOWNLOAD Patriotic M Joni Bescos
MS9999 PIPE | SONG Uptune M Name One; Name Two
MS0001 MALFORMED ROW WITH NO ARRANGER
MS10024 SEASONS OF LOVE Joey Minshall & Carolyn Schmidt
MS10024 SEASONS OF LOVE Another Arranger
U=Uptune B=Ballad SB=Swing Ballad E=Easy M=Medium D=Difficult SU=Swing Ballad YW=Voiced for Young Women **Prohibited
from Competition
Last Update: 8/11/2020
-- 1 of 1 --
`;

describe("Sweet Adelines published music source import", () => {
  it("normalizes source-only title markers without changing canonical voicing", () => {
    expect(normalizeSweetAdelinesTitle("BEST OF TIMES, THE")).toBe(
      "THE BEST OF TIMES"
    );
    expect(
      normalizeSweetAdelinesTitle(
        "YW - STAR SPANGLED BANNER (SSAA) FREE DOWNLOAD"
      )
    ).toBe("STAR SPANGLED BANNER");
  });

  it("extracts title and arranger rows as canonical SSAA suggestions", () => {
    const result = parseSweetAdelinesPublishedMusicText(fixtureText);

    expect(result.rows).toEqual([
      {
        title: "A COTTAGE FOR SALE",
        voicing: "SSAA",
        arranger: "Sharon Holmes",
        source: "Sweet Adelines published music list",
      },
      {
        title: "PIPE | SONG",
        voicing: "SSAA",
        arranger: "Name One, Name Two",
        source: "Sweet Adelines published music list",
      },
      {
        title: "SEASONS OF LOVE",
        voicing: "SSAA",
        arranger: "Another Arranger",
        source: "Sweet Adelines published music list",
      },
      {
        title: "SEASONS OF LOVE",
        voicing: "SSAA",
        arranger: "Joey Minshall and Carolyn Schmidt",
        source: "Sweet Adelines published music list",
      },
      {
        title: "STAR SPANGLED BANNER",
        voicing: "SSAA",
        arranger: "Joni Bescos",
        source: "Sweet Adelines published music list",
      },
      {
        title: "THE BEST OF TIMES",
        voicing: "SSAA",
        arranger: "Tedda Lippincott",
        source: "Sweet Adelines published music list",
      },
    ]);
    expect(result.report.duplicateRows).toBe(1);
    expect(result.report.skippedRows).toBe(1);
    expect(result.report.skipped[0].reason).toBe("could_not_split_title_arranger");
  });

  it("skips rows that cannot be split confidently", () => {
    const result = parseSweetAdelinesPublishedMusicText(`
      MS0001 ALL UPPERCASE UNKNOWN
    `);

    expect(result.rows).toEqual([]);
    expect(result.report.skipped).toEqual([
      {
        sourceId: "MS0001",
        record: "MS0001 ALL UPPERCASE UNKNOWN",
        reason: "could_not_split_title_arranger",
      },
    ]);
  });

  it("formats PSV with the shared header and escaped pipe characters", () => {
    const result = parseSweetAdelinesPublishedMusicText(fixtureText);
    const psv = formatSourcePsv(result.rows);

    expect(psv.startsWith("Song Title|Voicing|Arranger\n")).toBe(true);
    expect(psv).toContain("PIPE / SONG|SSAA|Name One, Name Two");
  });

  it("includes Sweet Adelines in the default source merge list", () => {
    expect(defaultSourcePaths.join("\n")).toContain(
      "data/sources/sweet_adelines_published_music_song_suggestions.psv"
    );
  });
});
