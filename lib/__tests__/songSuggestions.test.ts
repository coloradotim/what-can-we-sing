import { describe, expect, it } from "vitest";
import {
  getSongSuggestions,
  songSuggestionSubtitle,
} from "../songSuggestions";

describe("getSongSuggestions", () => {
  const rows = [
    {
      song_title: "Why Try to Change Me Now",
      voicing: "TTBB" as const,
      arranger_name: "SPEBSQSA",
    },
    {
      song_title: "Mam'selle",
      voicing: "TTBB" as const,
      arranger_name: null,
    },
    {
      song_title: "Mam'selle",
      voicing: "SATB" as const,
      arranger_name: null,
    },
    {
      song_title: "Why Try to Change Me Now",
      voicing: "TTBB" as const,
      arranger_name: "SPEBSQSA",
    },
    {
      song_title: "Heart of My Heart",
      voicing: "TTBB" as const,
      arranger_name: null,
    },
    {
      song_title: "Heart of My Heart",
      voicing: "TTBB" as const,
      arranger_name: "Unknown",
    },
    {
      song_title: "Heart of My Heart",
      voicing: "TTBB" as const,
      arranger_name: "Joe Arranger",
    },
  ];

  it("waits until the query is useful", () => {
    expect(getSongSuggestions(rows, "m")).toEqual([]);
  });

  it("groups matching title and arranger suggestions across voicings", () => {
    expect(getSongSuggestions(rows, "mam")).toEqual([
      {
        songTitle: "Mam'selle",
        arrangerName: "",
        voicings: ["TTBB", "SATB"],
      },
    ]);
  });

  it("matches arranger text without exposing parts or confidence", () => {
    expect(getSongSuggestions(rows, "speb")).toEqual([
      {
        songTitle: "Why Try to Change Me Now",
        arrangerName: "SPEBSQSA",
        voicings: ["TTBB"],
      },
    ]);
  });

  it("keeps blank arranger distinct from literal Unknown and entered names", () => {
    const suggestions = getSongSuggestions(rows, "heart");

    expect(suggestions).toEqual([
      {
        songTitle: "Heart of My Heart",
        arrangerName: "",
        voicings: ["TTBB"],
      },
      {
        songTitle: "Heart of My Heart",
        arrangerName: "Joe Arranger",
        voicings: ["TTBB"],
      },
      {
        songTitle: "Heart of My Heart",
        arrangerName: "Unknown",
        voicings: ["TTBB"],
      },
    ]);
    expect(suggestions.map(songSuggestionSubtitle)).toEqual([
      "No arranger entered · Lower voice (TTBB)",
      "Joe Arranger · Lower voice (TTBB)",
      "Unknown · Lower voice (TTBB)",
    ]);
  });

  it("does not collapse different explicit arrangers together", () => {
    const suggestions = getSongSuggestions(
      [
        {
          song_title: "Hello, My Baby",
          voicing: "TTBB",
          arranger_name: "Joe Liles",
        },
        {
          song_title: "Hello, My Baby",
          voicing: "SSAA",
          arranger_name: "Joe Liles",
        },
        {
          song_title: "Hello, My Baby",
          voicing: "TTBB",
          arranger_name: "Clay Hine",
        },
      ],
      "hello"
    );

    expect(suggestions).toEqual([
      {
        songTitle: "Hello, My Baby",
        arrangerName: "Clay Hine",
        voicings: ["TTBB"],
      },
      {
        songTitle: "Hello, My Baby",
        arrangerName: "Joe Liles",
        voicings: ["TTBB", "SSAA"],
      },
    ]);
  });

  it("groups title suggestions that differ only by leading article", () => {
    const suggestions = getSongSuggestions(
      [
        {
          song_title: "A Barbershop Time Of Your Life",
          voicing: "TTBB",
          arranger_name: "Joe Liles",
        },
        {
          song_title: "Barbershop Time of Your Life",
          voicing: "SSAA",
          arranger_name: "Joe Liles",
        },
        {
          song_title: "The Barbershop Time of Your Life",
          voicing: "TTBB",
          arranger_name: "Different Arranger",
        },
      ],
      "barbershop time"
    );

    expect(suggestions).toEqual([
      {
        songTitle: "A Barbershop Time Of Your Life",
        arrangerName: "Joe Liles",
        voicings: ["TTBB", "SSAA"],
      },
      {
        songTitle: "The Barbershop Time of Your Life",
        arrangerName: "Different Arranger",
        voicings: ["TTBB"],
      },
    ]);
  });

  it("matches searches that include an ignored leading article", () => {
    expect(
      getSongSuggestions(
        [
          {
            song_title: "Longest Time",
            voicing: "TTBB",
            arranger_name: "Test Arranger",
          },
        ],
        "the longest"
      )
    ).toEqual([
      {
        songTitle: "Longest Time",
        arrangerName: "Test Arranger",
        voicings: ["TTBB"],
      },
    ]);
  });
});
