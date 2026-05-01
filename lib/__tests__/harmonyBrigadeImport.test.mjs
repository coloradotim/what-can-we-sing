import { describe, expect, it } from "vitest";

const { parseHarmonyBrigadeSnapshots } = await import(
  "../../scripts/import-harmony-brigade-songs.mjs"
);

describe("Harmony Brigade import parsing", () => {
  it("dedupes songs, creates events, and links event-song appearances", () => {
    const parsed = parseHarmonyBrigadeSnapshots({
      songDataRows: [
        {
          SongID: "1",
          SongTitle: "After You Have Gone",
          KeyName: "Bb",
          Arranger: "David Wright",
          AsSungBy: "--",
          LT_Provider: "Tim Waurick",
          SongStyle: "Uptune",
          SongLength: "02:30",
          Difficulty: "",
          Genre: "",
          Tempo: "Uptune",
          StartingWords: "After you have gone",
        },
      ],
      historyRows: [
        {
          SongID: "1",
          YearHeld: "2024",
          BrigadeAbbr: "AHB",
          SongTitle: "After You Have Gone",
          KeyName: "Bb",
          CDTrackNum: "7",
          Arranger: "David Wright",
          AsSungBy: "--",
          LT_Provider: "Tim Waurick",
          SongStyle: "Uptune",
          SongLength: "02:30",
          StartingWords: "After you have gone",
        },
      ],
      brigadeRows: [
        {
          Brigade_ID: "3",
          BrigadeAbbr: "AHB",
          BrigadeName: "Atlantic HB",
          MonthHeld: "8",
          Website: "",
        },
      ],
    });

    expect(parsed.songs).toMatchObject([
      {
        source_song_id: 1,
        song_title: "After You Have Gone",
        normalized_title: "after you have gone",
        arranger: "David Wright",
        normalized_arranger: "david wright",
        default_voicing: "TTBB",
      },
    ]);
    expect(parsed.events).toEqual([
      {
        year_held: 2024,
        brigade_abbr: "AHB",
        brigade_name: "Atlantic HB",
        event_label: "2024 Atlantic HB (AHB)",
      },
    ]);
    expect(parsed.eventSongs).toEqual([
      {
        eventKey: "2024|AHB",
        source_song_id: 1,
        track_number: 7,
      },
    ]);
    expect(parsed.missingSongCount).toBe(0);
  });
});
