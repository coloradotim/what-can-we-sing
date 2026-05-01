import { describe, expect, it } from "vitest";

const { parseHarmonyBrigadeCsv } = await import(
  "../../scripts/build-harmony-brigade-data.mjs"
);

describe("Harmony Brigade data build", () => {
  it("parses the expected Ross Wilkins CSV schema", () => {
    const rows = parseHarmonyBrigadeCsv(
      [
        "SongID,SongTitle,KeyName,Arranger,AsSungBy,LT_Provider,SongStyle,SongLength,Difficulty,Genre,Tempo,StartingWords",
        '1,"After You Have Gone",Bb,"David Wright",--,"Tim Waurick",Uptune,02:30,NULL,NULL,Uptune,"After you have gone"',
      ].join("\n")
    );

    expect(rows).toEqual([
      {
        id: "1",
        title: "After You Have Gone",
        voicing: "TTBB",
        arranger: "David Wright",
        eventYear: null,
        eventName: "Ross Wilkins song database",
        sourceName: "Ross Wilkins' Harmony Brigade song database",
        keyName: "Bb",
        asSungBy: null,
        learningTrackProvider: "Tim Waurick",
        songStyle: "Uptune",
        songLength: "02:30",
        difficulty: null,
        genre: null,
        tempo: "Uptune",
        startingWords: "After you have gone",
      },
    ]);
  });

  it("keeps recoverable embedded quotes in source titles", () => {
    const rows = parseHarmonyBrigadeCsv(
      [
        "SongID,SongTitle,KeyName,Arranger,AsSungBy,LT_Provider,SongStyle,SongLength,Difficulty,Genre,Tempo,StartingWords",
        '465,"Theme from "New York, New York"",F,"Dan Wessler","After Hours","Tim Waurick",NULL,02:48,NULL,NULL,NULL,"Da da"',
      ].join("\n")
    );

    expect(rows[0].title).toBe('Theme from "New York, New York"');
    expect(rows[0].arranger).toBe("Dan Wessler");
  });
});
