import { describe, expect, it } from "vitest";
import { defaultSourcePaths } from "../../scripts/merge-song-suggestion-sources.mjs";
import { formatSourcePsv } from "../../scripts/song-sources/psv.mjs";
import { parseSweetAdelinesArrangedMusicText } from "../../scripts/song-sources/import-sweet-adelines-arranged-music.mjs";

const fixtureText = `
Sweet Adelines International Arranged Music List as of 8/8/2024
Id Number Title of Arrangement Arranger
I00008 004 MEDLEY - How Could You Believe Me Sylvia Alsbury
I03366 59TH STREET BRIDGE SONG, THE (FEELIN' GROOVY) Patsee Yvonne Parker
I03919 YOU RAISE ME UP Ms. Tedda Lippincott
I03716 HERE COMES THE SUN Joan D 'Agostino
I02511 SISTERS ARE DOING IT FOR THEMSELVES Åse Hagerman
I03779 WAY YOU LOOK TONIGHT, THE Dr. Diane M Clark
I00461 ALL OF MY LIFE Mary Grace Lodico
I04578 CHRISTMAS CONGA Randy Fink Sahae
I01389 LAZY RIVER Mary K. Coffman Music Fund
I99991 PIPE | SONG Name One; Name Two
I99992 DUPLICATE SONG Carolyn Johnson
I99992 DUPLICATE SONG Carolyn Johnson
I99993 DUPLICATE SONG Another Arranger
I99994 MALFORMED ROW
-- 1 of 1 --
`;

describe("Sweet Adelines arranged music source import", () => {
  it("extracts arranged music rows as canonical SSAA suggestions", () => {
    const result = parseSweetAdelinesArrangedMusicText(fixtureText);

    expect(result.rows).toEqual([
      {
        title: "59TH STREET BRIDGE SONG, THE (FEELIN' GROOVY)",
        voicing: "SSAA",
        arranger: "Patsee Yvonne Parker",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "ALL OF MY LIFE",
        voicing: "SSAA",
        arranger: "Mary Grace Lodico",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "CHRISTMAS CONGA",
        voicing: "SSAA",
        arranger: "Randy Fink Sahae",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "DUPLICATE SONG",
        voicing: "SSAA",
        arranger: "Another Arranger",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "DUPLICATE SONG",
        voicing: "SSAA",
        arranger: "Carolyn Johnson",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "HERE COMES THE SUN",
        voicing: "SSAA",
        arranger: "Joan D 'Agostino",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "LAZY RIVER",
        voicing: "SSAA",
        arranger: "Mary K. Coffman Music Fund",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "MEDLEY - How Could You Believe Me",
        voicing: "SSAA",
        arranger: "Sylvia Alsbury",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "PIPE | SONG",
        voicing: "SSAA",
        arranger: "Name One, Name Two",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "SISTERS ARE DOING IT FOR THEMSELVES",
        voicing: "SSAA",
        arranger: "Åse Hagerman",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "THE WAY YOU LOOK TONIGHT",
        voicing: "SSAA",
        arranger: "Diane M Clark",
        source: "Sweet Adelines arranged music list",
      },
      {
        title: "YOU RAISE ME UP",
        voicing: "SSAA",
        arranger: "Tedda Lippincott",
        source: "Sweet Adelines arranged music list",
      },
    ]);
    expect(result.report.duplicateRows).toBe(1);
    expect(result.report.skippedRows).toBe(1);
    expect(result.report.skipped[0].reason).toBe("could_not_split_title_arranger");
  });

  it("formats PSV with the shared header and escaped pipe characters", () => {
    const result = parseSweetAdelinesArrangedMusicText(fixtureText);
    const psv = formatSourcePsv(result.rows);

    expect(psv.startsWith("Song Title|Voicing|Arranger\n")).toBe(true);
    expect(psv).toContain("PIPE / SONG|SSAA|Name One, Name Two");
  });

  it("includes arranged music in the default source merge list", () => {
    expect(defaultSourcePaths.join("\n")).toContain(
      "data/sources/sweet_adelines_arranged_music_song_suggestions.psv"
    );
  });
});
