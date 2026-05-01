import { describe, expect, it } from "vitest";
import type { RepertoireRow } from "@/lib/repertoireStore";
import {
  buildHarmonyBrigadeAddInputs,
  getHarmonyBrigadeEvents,
  getHarmonyBrigadeSongs,
  getHarmonyBrigadeSongsForEvent,
  HARMONY_BRIGADE_DEFAULT_VOICING,
  HARMONY_BRIGADE_SOURCE,
  resolveHarmonyBrigadeCandidates,
  searchHarmonyBrigadeCandidates,
  type HarmonyBrigadeSong,
} from "@/lib/harmonyBrigade";

function repertoireRow(
  song_title: string,
  voicing: RepertoireRow["voicing"],
  arranger_name: string | null
) {
  return {
    song_title,
    voicing,
    arranger_name,
  } as RepertoireRow;
}

const sampleSong = (
  id: string,
  title: string,
  arranger: string | null,
  eventYear: string | null = "2024",
  eventName = "Delaware Valley"
): HarmonyBrigadeSong => ({
  id,
  title,
  voicing: HARMONY_BRIGADE_DEFAULT_VOICING,
  arranger,
  eventYear,
  eventName,
  sourceName: HARMONY_BRIGADE_SOURCE,
  keyName: null,
  asSungBy: null,
  learningTrackProvider: null,
  songStyle: null,
  songLength: null,
  difficulty: null,
  genre: null,
  tempo: null,
  startingWords: null,
});

describe("Harmony Brigade songs", () => {
  it("loads the Ross Wilkins source as TTBB songs with event metadata", () => {
    const songs = getHarmonyBrigadeSongs();
    const events = getHarmonyBrigadeEvents();

    expect(songs.length).toBeGreaterThan(400);
    expect(songs.every((song) => song.voicing === "TTBB")).toBe(true);
    expect(songs.some((song) => song.title === 'Theme from "New York, New York"')).toBe(
      true
    );
    expect(events).toEqual([
      {
        key: "All years|Ross Wilkins song database",
        year: null,
        yearLabel: "All years",
        eventName: "Ross Wilkins song database",
        songCount: songs.length,
      },
    ]);
  });

  it("groups source rows by Brigade year and location when available", () => {
    const events = getHarmonyBrigadeEvents([
      sampleSong("1", "A", null, "2024", "Delaware Valley"),
      sampleSong("2", "B", null, "2024", "Delaware Valley"),
      sampleSong("3", "C", null, "2023", "Atlantic"),
    ]);

    expect(events).toEqual([
      {
        key: "2024|Delaware Valley",
        year: "2024",
        yearLabel: "2024",
        eventName: "Delaware Valley",
        songCount: 2,
      },
      {
        key: "2023|Atlantic",
        year: "2023",
        yearLabel: "2023",
        eventName: "Atlantic",
        songCount: 1,
      },
    ]);
  });

  it("filters songs for the selected event", () => {
    const songs = [
      sampleSong("1", "A", null, "2024", "Delaware Valley"),
      sampleSong("2", "B", null, "2023", "Atlantic"),
    ];

    expect(getHarmonyBrigadeSongsForEvent("2024", "Delaware Valley", songs)).toEqual([
      songs[0],
    ]);
  });

  it("marks exact duplicates without treating blank arranger as Unknown", () => {
    const resolved = resolveHarmonyBrigadeCandidates(
      [
        sampleSong("1", "Hello, My Baby", "Joe Liles"),
        sampleSong("2", "Coney Island Baby", null),
      ],
      [
        repertoireRow("Hello My Baby", "TTBB", "Joe Liles"),
        repertoireRow("Coney Island Baby", "TTBB", "Unknown"),
      ]
    );

    expect(resolved.map((song) => song.duplicateStatus)).toEqual([
      "exact",
      "eligible",
    ]);
  });

  it("builds add inputs with TTBB and the user's batch part and confidence", () => {
    const candidates = resolveHarmonyBrigadeCandidates(
      [
        sampleSong("1", "Hello, My Baby", "Joe Liles"),
        sampleSong("2", "Already There", "Someone"),
      ],
      [repertoireRow("Already There", "TTBB", "Someone")]
    );

    expect(
      buildHarmonyBrigadeAddInputs(
        candidates,
        new Set(["1", "2"]),
        "Lead",
        "A Little Rusty"
      )
    ).toEqual([
      {
        songTitle: "Hello, My Baby",
        voicing: "TTBB",
        arrangerName: "Joe Liles",
        partConfidences: [
          {
            part: "Lead",
            confidence: "A Little Rusty",
          },
        ],
      },
    ]);
  });

  it("searches the selected Brigade songs without using normal typeahead", () => {
    const candidates = resolveHarmonyBrigadeCandidates(
      [
        { ...sampleSong("1", "Hello, My Baby", "Joe Liles"), asSungBy: "Acoustix" },
        sampleSong("2", "Coney Island Baby", null),
      ],
      []
    );

    expect(searchHarmonyBrigadeCandidates(candidates, "acoustix")).toEqual([
      candidates[0],
    ]);
  });
});
