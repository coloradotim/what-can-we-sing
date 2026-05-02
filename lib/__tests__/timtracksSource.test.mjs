import { describe, expect, it } from "vitest";
import { formatSourcePsv } from "../../scripts/song-sources/psv.mjs";
import {
  holidayVoicingForTimTracksRow,
  normalizeTimTracksArranger,
  textFromHtml,
  transformTimTracksRows,
} from "../../scripts/song-sources/scrape-timtracks.mjs";

describe("TimTracks source scraper transforms", () => {
  it("normalizes HTML text and arranger names", () => {
    expect(textFromHtml("<a>Closest Thing To Crazy, The</a>")).toBe(
      "Closest Thing To Crazy, The"
    );
    expect(normalizeTimTracksArranger("Name One; Name Two & Name Three")).toBe(
      "Name One, Name Two and Name Three"
    );
    expect(normalizeTimTracksArranger("<a>McAlexander, Patrick</a>")).toBe(
      "Patrick McAlexander"
    );
  });

  it("maps source pages to supported voicings and normalizes trailing articles", () => {
    const transformed = transformTimTracksRows({
      mensTracks: [
        {
          id: "1",
          title: "Closest Thing To Crazy, The",
          arrangerDisplayName: "Example, Arranger",
        },
      ],
      womensTracks: [
        {
          id: "2",
          title: "Winter's Tale, A",
          arrangerDisplayName: "Name One & Name Two",
        },
      ],
      mixedTracks: [
        {
          id: "3",
          title: "Example Song, An",
          arrangerDisplayName: "Name One; Name Two",
        },
      ],
    });

    expect(transformed.rows).toEqual([
      {
        title: "A Winter's Tale",
        voicing: "SSAA",
        arranger: "Name One and Name Two",
        source: "TimTracks",
      },
      {
        title: "An Example Song",
        voicing: "SATB",
        arranger: "Name One, Name Two",
        source: "TimTracks",
      },
      {
        title: "The Closest Thing To Crazy",
        voicing: "TTBB",
        arranger: "Arranger Example",
        source: "TimTracks",
      },
    ]);
  });

  it("imports holiday rows only when voicing is confident", () => {
    expect(holidayVoicingForTimTracksRow({ numMaleParts: "4", numFemaleParts: "0" }))
      .toBe("TTBB");
    expect(holidayVoicingForTimTracksRow({ numMaleParts: "0", numFemaleParts: "4" }))
      .toBe("SSAA");
    expect(holidayVoicingForTimTracksRow({ numMaleParts: "2", numFemaleParts: "2" }))
      .toBe("SATB");
    expect(holidayVoicingForTimTracksRow({ numMaleParts: "5", numFemaleParts: "0" }))
      .toBeNull();

    const transformed = transformTimTracksRows({
      holidayTracks: [
        {
          id: "4",
          title: "Confident Holiday",
          arrangerDisplayName: "Someone",
          numMaleParts: "4",
          numFemaleParts: "0",
        },
        {
          id: "5",
          title: "Ambiguous Holiday",
          arrangerDisplayName: "Someone",
          numMaleParts: "5",
          numFemaleParts: "0",
        },
      ],
    });

    expect(transformed.rows).toEqual([
      {
        title: "Confident Holiday",
        voicing: "TTBB",
        arranger: "Someone",
        source: "TimTracks",
      },
    ]);
    expect(transformed.report.skipped).toEqual([
      {
        sourceType: "holidayTracks",
        id: "5",
        title: "Ambiguous Holiday",
        arranger: "Someone",
        numMaleParts: "5",
        numFemaleParts: "0",
        reason: "ambiguous_holiday_voicing",
      },
    ]);
  });

  it("dedupes exact source duplicates while preserving different voicing and arranger", () => {
    const transformed = transformTimTracksRows({
      mensTracks: [
        { title: "Same Song", arrangerDisplayName: "A Person" },
        { title: "Same Song", arrangerDisplayName: "A Person" },
        { title: "Same Song", arrangerDisplayName: "Another Person" },
      ],
      womensTracks: [{ title: "Same Song", arrangerDisplayName: "A Person" }],
    });

    expect(transformed.report.duplicateRows).toBe(1);
    expect(transformed.rows).toEqual([
      {
        title: "Same Song",
        voicing: "SSAA",
        arranger: "A Person",
        source: "TimTracks",
      },
      {
        title: "Same Song",
        voicing: "TTBB",
        arranger: "A Person",
        source: "TimTracks",
      },
      {
        title: "Same Song",
        voicing: "TTBB",
        arranger: "Another Person",
        source: "TimTracks",
      },
    ]);
  });

  it("skips unknown or malformed rows and keeps PSV rows well-formed", () => {
    const transformed = transformTimTracksRows({
      mensTracks: [
        { title: "", arrangerDisplayName: "Someone" },
        { title: "Missing Arranger", arrangerDisplayName: "" },
        { title: "Pipe | Song", arrangerDisplayName: "Arranger | Name" },
      ],
    });

    expect(transformed.rows).toEqual([
      {
        title: "Pipe | Song",
        voicing: "TTBB",
        arranger: "Arranger | Name",
        source: "TimTracks",
      },
    ]);
    expect(transformed.report.skipped.map((row) => row.reason)).toEqual([
      "missing_title",
      "missing_arranger",
    ]);
    expect(formatSourcePsv(transformed.rows)).toContain(
      "Pipe / Song|TTBB|Arranger / Name"
    );
  });
});
