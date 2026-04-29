import { describe, expect, it } from "vitest";
import { getSongSuggestions } from "../songSuggestions";

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

  it("returns unique title, voicing, and arranger suggestions", () => {
    expect(getSongSuggestions(rows, "mam")).toEqual([
      {
        songTitle: "Mam'selle",
        voicing: "SATB",
        arrangerName: "",
      },
      {
        songTitle: "Mam'selle",
        voicing: "TTBB",
        arrangerName: "",
      },
    ]);
  });

  it("matches arranger text without exposing parts or confidence", () => {
    expect(getSongSuggestions(rows, "speb")).toEqual([
      {
        songTitle: "Why Try to Change Me Now",
        voicing: "TTBB",
        arrangerName: "SPEBSQSA",
      },
    ]);
  });

  it("keeps blank arranger distinct from literal Unknown and entered names", () => {
    expect(getSongSuggestions(rows, "heart")).toEqual([
      {
        songTitle: "Heart of My Heart",
        voicing: "TTBB",
        arrangerName: "",
      },
      {
        songTitle: "Heart of My Heart",
        voicing: "TTBB",
        arrangerName: "Joe Arranger",
      },
      {
        songTitle: "Heart of My Heart",
        voicing: "TTBB",
        arrangerName: "Unknown",
      },
    ]);
  });
});
