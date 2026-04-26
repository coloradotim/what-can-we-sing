import { describe, expect, it } from "vitest";
import { findMatches, SingerEntry } from "../matching";

describe("findMatches", () => {
  it("does not let one singer cover multiple quartet parts", () => {
    const entries: SingerEntry[] = [
      {
        userId: "tim",
        displayName: "Tim",
        songTitle: "Why Try to Change Me Now",
        voicing: "TTBB",
        partsKnown: ["Tenor", "Lead", "Baritone", "Bass"],
        confidence: "Solid",
      },
    ];

    const matches = findMatches(entries);

    expect(matches).toEqual([]);
  });

  it("finds a ready match when four distinct singers cover TTBB", () => {
    const entries: SingerEntry[] = [
      {
        userId: "1",
        displayName: "A",
        songTitle: "Test Song",
        voicing: "TTBB",
        partsKnown: ["Tenor"],
      },
      {
        userId: "2",
        displayName: "B",
        songTitle: "Test Song",
        voicing: "TTBB",
        partsKnown: ["Lead"],
      },
      {
        userId: "3",
        displayName: "C",
        songTitle: "Test Song",
        voicing: "TTBB",
        partsKnown: ["Baritone"],
      },
      {
        userId: "4",
        displayName: "D",
        songTitle: "Test Song",
        voicing: "TTBB",
        partsKnown: ["Bass"],
      },
    ];

    const matches = findMatches(entries);

    expect(matches.length).toBe(1);
    expect(matches[0].missingParts).toEqual([]);
  });
});