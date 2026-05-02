import { describe, expect, it } from "vitest";
import type { RepertoireRow } from "@/lib/repertoireStore";
import {
  buildHarmonyBrigadeAddInputs,
  fetchHarmonyBrigadeEventSongPages,
  filterHarmonyBrigadeSongs,
  getHarmonyBrigadeBrigadeOptions,
  getHarmonyBrigadeYearOptions,
  HARMONY_BRIGADE_ALL_BRIGADES,
  HARMONY_BRIGADE_ALL_YEARS,
  harmonyBrigadeEventSongKey,
  harmonyBrigadeSelectionDescription,
  resolveHarmonyBrigadeCandidates,
  type HarmonyBrigadeEvent,
  type HarmonyBrigadeEventSong,
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

const event = (
  id: string,
  yearHeld: number,
  brigadeAbbr: string,
  brigadeName: string | null
): HarmonyBrigadeEvent => ({
  id,
  yearHeld,
  brigadeAbbr,
  brigadeName,
  eventLabel: brigadeName
    ? `${yearHeld} ${brigadeName} (${brigadeAbbr})`
    : `${yearHeld} ${brigadeAbbr}`,
});

const eventSong = (
  songId: string,
  songTitle: string,
  arranger: string | null,
  sourceEvent: HarmonyBrigadeEvent
): HarmonyBrigadeEventSong => ({
  event: sourceEvent,
  song: {
    id: songId,
    sourceSongId: Number(songId),
    songTitle,
    arranger,
    defaultVoicing: "TTBB",
    songKey: "Bb",
    startingWords: "Hello there",
    asSungBy: null,
    learningTrackProvider: null,
    songStyle: null,
    songLength: null,
  },
  trackNumber: null,
  sortOrder: null,
});

const atlantic2024 = event("event-1", 2024, "AHB", "Atlantic HB");
const carolina2024 = event("event-2", 2024, "NCHB", "North Carolina HB");
const atlantic2023 = event("event-3", 2023, "AHB", "Atlantic HB");

describe("Harmony Brigade source helpers", () => {
  it("builds real year and brigade filter options from event rows", () => {
    const events = [atlantic2024, carolina2024, atlantic2023];

    expect(getHarmonyBrigadeYearOptions(events)).toEqual([
      HARMONY_BRIGADE_ALL_YEARS,
      2024,
      2023,
    ]);
    expect(getHarmonyBrigadeBrigadeOptions(2024, events)).toEqual([
      { value: HARMONY_BRIGADE_ALL_BRIGADES, label: "All brigades" },
      { value: "AHB", label: "Atlantic HB (AHB)" },
      { value: "NCHB", label: "North Carolina HB (NCHB)" },
    ]);
  });

  it("supports all filter combinations without using source names as options", () => {
    const rows = [
      eventSong("1", "A", "Arranger", atlantic2024),
      eventSong("2", "B", "Arranger", carolina2024),
      eventSong("3", "C", "Arranger", atlantic2023),
    ];

    expect(
      filterHarmonyBrigadeSongs(rows, HARMONY_BRIGADE_ALL_YEARS, "AHB").map(
        (row) => row.song.songTitle
      )
    ).toEqual(["A", "C"]);
    expect(
      filterHarmonyBrigadeSongs(rows, 2024, HARMONY_BRIGADE_ALL_BRIGADES).map(
        (row) => row.song.songTitle
      )
    ).toEqual(["A", "B"]);
    expect(filterHarmonyBrigadeSongs(rows, 2024, "NCHB")).toEqual([rows[1]]);
  });

  it("preserves the same song across multiple event appearances", () => {
    const rows = [
      eventSong("1", "A", "Arranger", atlantic2024),
      eventSong("1", "A", "Arranger", atlantic2023),
    ];

    expect(
      filterHarmonyBrigadeSongs(rows, HARMONY_BRIGADE_ALL_YEARS, "AHB")
    ).toEqual(rows);
  });

  it("paginates event-song queries instead of relying on one capped response", async () => {
    const calls: Array<[number, number]> = [];
    const pages = [
      [{ id: "1" }, { id: "2" }],
      [{ id: "3" }, { id: "4" }],
      [{ id: "5" }],
    ];

    const rows = await fetchHarmonyBrigadeEventSongPages((from, to) => {
      calls.push([from, to]);
      return Promise.resolve({
        data: pages[calls.length - 1] as never,
        error: null,
      });
    }, 2);

    expect(calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(rows).toHaveLength(5);
  });

  it("uses natural preview copy for selected scope", () => {
    const events = [atlantic2024, carolina2024];

    expect(
      harmonyBrigadeSelectionDescription(
        HARMONY_BRIGADE_ALL_YEARS,
        HARMONY_BRIGADE_ALL_BRIGADES,
        477,
        events
      )
    ).toBe("We found 477 Harmony Brigade songs.");
    expect(
      harmonyBrigadeSelectionDescription(
        HARMONY_BRIGADE_ALL_YEARS,
        "AHB",
        120,
        events
      )
    ).toBe("We found 120 songs for all Atlantic HB (AHB) events.");
    expect(
      harmonyBrigadeSelectionDescription(
        2024,
        HARMONY_BRIGADE_ALL_BRIGADES,
        80,
        events
      )
    ).toBe("We found 80 songs from 2024.");
    expect(harmonyBrigadeSelectionDescription(2024, "AHB", 42, events)).toBe(
      "We found 42 songs for 2024 Atlantic HB (AHB)."
    );
  });

  it("marks exact duplicates while preserving blank versus Unknown arranger", () => {
    const resolved = resolveHarmonyBrigadeCandidates(
      [
        eventSong("1", "Hello, My Baby", "Joe Liles", atlantic2024),
        eventSong("2", "Coney Island Baby", null, atlantic2024),
      ],
      [
        repertoireRow("Hello My Baby", "TTBB", "Joe Liles"),
        repertoireRow("Coney Island Baby", "TTBB", "Unknown"),
      ]
    );

    expect(resolved.map((row) => row.duplicateStatus)).toEqual([
      "exact",
      "eligible",
    ]);
  });

  it("builds TTBB add inputs with per-song part confidence choices", () => {
    const candidates = resolveHarmonyBrigadeCandidates(
      [
        eventSong("1", "Hello, My Baby", "Joe Liles", atlantic2024),
        eventSong("2", "Already There", "Someone", atlantic2024),
      ],
      [repertoireRow("Already There", "TTBB", "Someone")]
    );

    expect(
      buildHarmonyBrigadeAddInputs(
        candidates,
        {
          [harmonyBrigadeEventSongKey(candidates[0])]: {
            Lead: "A Little Rusty",
            Baritone: "Good to Go",
          },
          [harmonyBrigadeEventSongKey(candidates[1])]: {
            Bass: "Good to Go",
          },
        }
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
          {
            part: "Baritone",
            confidence: "Good to Go",
          },
        ],
      },
    ]);
  });

  it("merges part confidence choices from duplicate event appearances", () => {
    const candidates = resolveHarmonyBrigadeCandidates(
      [
        eventSong("1", "Hello, My Baby", "Joe Liles", atlantic2024),
        eventSong("1", "Hello, My Baby", "Joe Liles", atlantic2023),
      ],
      []
    );

    expect(
      buildHarmonyBrigadeAddInputs(candidates, {
        [harmonyBrigadeEventSongKey(candidates[0])]: {
          Lead: "A Little Rusty",
        },
        [harmonyBrigadeEventSongKey(candidates[1])]: {
          Lead: "Good to Go",
          Bass: "Music Required",
        },
      })
    ).toEqual([
      {
        songTitle: "Hello, My Baby",
        voicing: "TTBB",
        arrangerName: "Joe Liles",
        partConfidences: [
          {
            part: "Lead",
            confidence: "Good to Go",
          },
          {
            part: "Bass",
            confidence: "Music Required",
          },
        ],
      },
    ]);
  });
});
