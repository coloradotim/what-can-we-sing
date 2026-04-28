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
});
