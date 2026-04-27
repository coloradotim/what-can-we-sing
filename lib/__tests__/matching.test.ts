import { describe, expect, it } from "vitest";
import { findMatches, normalizeConfidence, SingerEntry } from "../matching";

describe("findMatches", () => {
  it("maps legacy confidence values to the new scale", () => {
    expect(normalizeConfidence("Performance ready")).toBe("Good to Go");
    expect(normalizeConfidence("Solid")).toBe("Good to Go");
    expect(normalizeConfidence("Needs review")).toBe("A Little Rusty");
    expect(normalizeConfidence("Rusty")).toBe("A Little Rusty");
    expect(normalizeConfidence("Learning")).toBe("Music Required");
  });

  it("does not let one singer cover multiple quartet parts", () => {
    const entries: SingerEntry[] = [
      {
        userId: "tim",
        displayName: "Tim",
        songTitle: "Why Try to Change Me Now",
        voicing: "TTBB",
        partsKnown: ["Tenor", "Lead", "Baritone", "Bass"],
        confidence: "Good to Go",
      },
    ];

    expect(findMatches(entries)).toEqual([]);
  });

  it("finds a match when four distinct singers cover TTBB", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Test Song", voicing: "TTBB", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "Test Song", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "Test Song", voicing: "TTBB", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "D", songTitle: "Test Song", voicing: "TTBB", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches.length).toBe(1);
    expect(matches[0].missingParts).toEqual([]);
  });

  it("does not combine the same song across different voicings", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Same Song", voicing: "TTBB", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "Same Song", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "Same Song", voicing: "SSAA", partsKnown: ["Alto 1"] },
      { userId: "4", displayName: "D", songTitle: "Same Song", voicing: "SSAA", partsKnown: ["Alto 2"] },
    ];

    expect(findMatches(entries)).toEqual([]);
  });

  it("marks a complete match as possible when arrangers conflict", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger One", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger Two", partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger One", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "D", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger One", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches[0].category).toBe("possible");
    expect(matches[0].warnings).toContain("Possible arranger conflict.");
  });

  it("marks a complete match as possible when an arranger is missing", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: "Known Arranger", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: null, partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: "Known Arranger", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "D", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: "Known Arranger", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches[0].category).toBe("possible");
    expect(matches[0].warnings).toContain("Arranger missing for at least one singer.");
  });

  it("uses SATB required parts", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "SATB Song", voicing: "SATB", partsKnown: ["Soprano"] },
      { userId: "2", displayName: "B", songTitle: "SATB Song", voicing: "SATB", partsKnown: ["Alto"] },
      { userId: "3", displayName: "C", songTitle: "SATB Song", voicing: "SATB", partsKnown: ["Tenor"] },
      { userId: "4", displayName: "D", songTitle: "SATB Song", voicing: "SATB", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(Object.keys(matches[0].assignments).sort()).toEqual(
      ["Alto", "Bass", "Soprano", "Tenor"].sort()
    );
  });

  it("uses SSAA required parts", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "SSAA Song", voicing: "SSAA", partsKnown: ["Soprano 1"] },
      { userId: "2", displayName: "B", songTitle: "SSAA Song", voicing: "SSAA", partsKnown: ["Soprano 2"] },
      { userId: "3", displayName: "C", songTitle: "SSAA Song", voicing: "SSAA", partsKnown: ["Alto 1"] },
      { userId: "4", displayName: "D", songTitle: "SSAA Song", voicing: "SSAA", partsKnown: ["Alto 2"] },
    ];

    const matches = findMatches(entries);

    expect(Object.keys(matches[0].assignments).sort()).toEqual(
      ["Alto 1", "Alto 2", "Soprano 1", "Soprano 2"].sort()
    );
  });

  it("normalizes song titles when grouping matches", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Hello, Mary Lou!", voicing: "TTBB", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "hello mary lou", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "HELLO MARY LOU", voicing: "TTBB", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "D", songTitle: "Hello Mary-Lou", voicing: "TTBB", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches.length).toBe(1);
    expect(matches[0].songTitle).toBe("Hello, Mary Lou!");
  });

  it("returns one_part_missing when three distinct singers cover three TTBB parts", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Baritone"] },
    ];

    const matches = findMatches(entries);

    expect(matches.length).toBe(1);
    expect(matches[0].category).toBe("one_part_missing");
    expect(matches[0].missingParts).toEqual(["Bass"]);
  });

  it("returns no match when only two distinct singers are available for TTBB", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Too Few Singers", voicing: "TTBB", partsKnown: ["Tenor", "Lead"] },
      { userId: "2", displayName: "B", songTitle: "Too Few Singers", voicing: "TTBB", partsKnown: ["Baritone", "Bass"] },
    ];

    expect(findMatches(entries)).toEqual([]);
  });

  it("assigns a flexible singer to the constrained part when needed", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "Flexible", songTitle: "Constraint Song", voicing: "TTBB", partsKnown: ["Tenor", "Lead"] },
      { userId: "2", displayName: "Lead Only", songTitle: "Constraint Song", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "Bari", songTitle: "Constraint Song", voicing: "TTBB", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "Bass", songTitle: "Constraint Song", voicing: "TTBB", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches[0].assignments.Tenor?.[0].displayName).toBe("Flexible");
    expect(matches[0].assignments.Lead?.[0].displayName).toBe("Lead Only");
  });

  it("ranks complete matches above one-part-missing matches", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Good to Go" },

      { userId: "1", displayName: "A", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Complete Song");
  });

  it("prefers stronger confidence when ranking within the same category", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "A Little Rusty" },
      { userId: "2", displayName: "B", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "A Little Rusty" },
      { userId: "3", displayName: "C", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "A Little Rusty" },
      { userId: "4", displayName: "D", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "A Little Rusty" },

      { userId: "1", displayName: "A", songTitle: "Strong Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Strong Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Strong Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Strong Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Strong Song");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });
});
