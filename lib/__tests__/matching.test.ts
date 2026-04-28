import { describe, expect, it } from "vitest";
import {
  arrangementCheckNote,
  findMatches,
  normalizeConfidence,
  possibleSameSongNote,
  SingerEntry,
} from "../matching";

describe("findMatches", () => {
  it("maps legacy confidence values to the new scale", () => {
    expect(normalizeConfidence("Performance ready")).toBe("Good to Go");
    expect(normalizeConfidence("Solid")).toBe("Good to Go");
    expect(normalizeConfidence("Needs review")).toBe("A Little Rusty");
    expect(normalizeConfidence("Rusty")).toBe("A Little Rusty");
    expect(normalizeConfidence("Learning")).toBe("Music Required");
  });

  it("keeps current confidence values and rejects unknown values", () => {
    expect(normalizeConfidence("Good to Go")).toBe("Good to Go");
    expect(normalizeConfidence("A Little Rusty")).toBe("A Little Rusty");
    expect(normalizeConfidence("Music Required")).toBe("Music Required");
    expect(normalizeConfidence("Unknown")).toBeNull();
    expect(normalizeConfidence(null)).toBeNull();
  });

  it("adds confidence warnings for rusty or music-required singers", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "Ready", songTitle: "Warning Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "Rusty", songTitle: "Warning Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "A Little Rusty" },
      { userId: "3", displayName: "Music", songTitle: "Warning Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Music Required" },
      { userId: "4", displayName: "Ready Bass", songTitle: "Warning Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].warnings).toContain(
      "Confidence warning: Rusty marked A Little Rusty on Lead, Music marked Music Required on Baritone"
    );
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

  it("keeps a complete match ready when arrangers differ", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger One", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger Two", partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger One", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "D", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Arranger One", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches[0].category).toBe("ready");
    expect(matches[0].warnings).toContain(arrangementCheckNote);
  });

  it("keeps a complete match ready when some arrangers are missing", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: "Known Arranger", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "B", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: null, partsKnown: ["Lead"] },
      { userId: "3", displayName: "C", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: "Known Arranger", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "D", songTitle: "Unknown Arranger Song", voicing: "TTBB", arrangerName: "Known Arranger", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches[0].category).toBe("ready");
    expect(matches[0].warnings).toContain(arrangementCheckNote);
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

  it("suggests a possible match for conservative near-duplicate titles", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "T", songTitle: "Why Try to Change Me", voicing: "TTBB", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "L", songTitle: "Why Try to Change Me", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "Bari", songTitle: "Why Try to Change Me", voicing: "TTBB", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "Bass", songTitle: "Why Try To Change Me Now", voicing: "TTBB", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      songTitle: "Why Try To Change Me Now",
      category: "possible",
      missingParts: [],
    });
    expect(matches[0].warnings).toContain(
      possibleSameSongNote("Why Try to Change Me", "Why Try To Change Me Now")
    );
    expect(matches[0].titleMatchType).toBe("fuzzy");
    expect(matches[0].titleVariants).toEqual([
      {
        title: "Why Try to Change Me",
        normalizedTitle: "whytrytochangeme",
        singers: [
          { displayName: "T", part: "Tenor", confidence: null },
          { displayName: "L", part: "Lead", confidence: null },
          { displayName: "Bari", part: "Baritone", confidence: null },
        ],
      },
      {
        title: "Why Try To Change Me Now",
        normalizedTitle: "whytrytochangemenow",
        singers: [
          { displayName: "Bass", part: "Bass", confidence: null },
        ],
      },
    ]);
    expect(matches[1]).toMatchObject({
      songTitle: "Why Try to Change Me",
      category: "one_part_missing",
      missingParts: ["Bass"],
    });
  });

  it("does not make fuzzy title suggestions ready-to-sing matches", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "T", songTitle: "Hello Mary Lu", voicing: "TTBB", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "L", songTitle: "Hello Mary Lu", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "Bari", songTitle: "Hello Mary Lu", voicing: "TTBB", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "Bass", songTitle: "Hello, Mary Lou!", voicing: "TTBB", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches.some((match) => match.category === "ready")).toBe(false);
    expect(matches[0].category).toBe("possible");
  });

  it("does not suggest fuzzy title matches across different voicings", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "T", songTitle: "Why Try to Change Me", voicing: "TTBB", partsKnown: ["Tenor"] },
      { userId: "2", displayName: "L", songTitle: "Why Try to Change Me", voicing: "TTBB", partsKnown: ["Lead"] },
      { userId: "3", displayName: "Bari", songTitle: "Why Try to Change Me", voicing: "TTBB", partsKnown: ["Baritone"] },
      { userId: "4", displayName: "Bass", songTitle: "Why Try To Change Me Now", voicing: "SATB", partsKnown: ["Bass"] },
    ];

    const matches = findMatches(entries);

    expect(matches).toHaveLength(1);
    expect(matches[0].category).toBe("one_part_missing");
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
      { userId: "1", displayName: "A", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Music Required" },
      { userId: "2", displayName: "B", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Music Required" },
      { userId: "3", displayName: "C", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Music Required" },
      { userId: "4", displayName: "D", songTitle: "Complete Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Music Required" },

      { userId: "1", displayName: "A", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Complete Song");
  });

  it("does not downgrade or outrank matches based on arranger differences", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Clean Arranger Song", voicing: "TTBB", arrangerName: "Same Arranger", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Clean Arranger Song", voicing: "TTBB", arrangerName: "Same Arranger", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Clean Arranger Song", voicing: "TTBB", arrangerName: "Same Arranger", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Clean Arranger Song", voicing: "TTBB", arrangerName: "Same Arranger", partsKnown: ["Bass"], confidence: "Good to Go" },

      { userId: "1", displayName: "A", songTitle: "Different Arranger Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Different Arranger Song", voicing: "TTBB", arrangerName: "Two", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Different Arranger Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Different Arranger Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Bass"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Clean Arranger Song");
    expect(matches[0].category).toBe("ready");
    expect(matches[0].score).toBe(matches[1].score);
    expect(matches[1].category).toBe("ready");
    expect(matches[1].warnings).toContain(arrangementCheckNote);
  });

  it("ranks ready matches with arranger differences above one-part-missing matches", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Possible Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Tenor"], confidence: "Music Required" },
      { userId: "2", displayName: "B", songTitle: "Possible Song", voicing: "TTBB", arrangerName: "Two", partsKnown: ["Lead"], confidence: "Music Required" },
      { userId: "3", displayName: "C", songTitle: "Possible Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Baritone"], confidence: "Music Required" },
      { userId: "4", displayName: "D", songTitle: "Possible Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Bass"], confidence: "Music Required" },

      { userId: "1", displayName: "A", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Almost Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Possible Song");
    expect(matches[0].category).toBe("ready");
    expect(matches[1].category).toBe("one_part_missing");
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

  it("ranks a little rusty above music required within the same category", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Music Required Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Music Required" },
      { userId: "2", displayName: "B", songTitle: "Music Required Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Music Required" },
      { userId: "3", displayName: "C", songTitle: "Music Required Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Music Required" },
      { userId: "4", displayName: "D", songTitle: "Music Required Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Music Required" },

      { userId: "1", displayName: "A", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "A Little Rusty" },
      { userId: "2", displayName: "B", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "A Little Rusty" },
      { userId: "3", displayName: "C", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "A Little Rusty" },
      { userId: "4", displayName: "D", songTitle: "Rusty Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "A Little Rusty" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Rusty Song");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it("prefers the stronger singer when multiple singers can cover the same part", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "Rusty Tenor", songTitle: "Choice Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Music Required" },
      { userId: "2", displayName: "Ready Tenor", songTitle: "Choice Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "3", displayName: "Lead", songTitle: "Choice Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "4", displayName: "Bari", songTitle: "Choice Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "5", displayName: "Bass", songTitle: "Choice Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].assignments.Tenor?.[0].displayName).toBe("Ready Tenor");
  });

  it("uses confidence for the assigned part when choosing flexible singers", () => {
    const entries: SingerEntry[] = [
      {
        userId: "1",
        displayName: "Flexible",
        songTitle: "Part Confidence Song",
        voicing: "TTBB",
        partsKnown: ["Tenor", "Lead"],
        confidence: "Music Required",
        partConfidences: {
          Tenor: "Music Required",
          Lead: "Good to Go",
        },
      },
      {
        userId: "2",
        displayName: "Tenor Only",
        songTitle: "Part Confidence Song",
        voicing: "TTBB",
        partsKnown: ["Tenor"],
        confidence: "Music Required",
        partConfidences: {
          Tenor: "Good to Go",
        },
      },
      { userId: "3", displayName: "Bari", songTitle: "Part Confidence Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "Bass", songTitle: "Part Confidence Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].assignments.Tenor?.[0].displayName).toBe("Tenor Only");
    expect(matches[0].assignments.Lead?.[0].displayName).toBe("Flexible");
  });

  it("uses extra part coverage as a modest tie-breaker", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Flexible Song", voicing: "TTBB", partsKnown: ["Tenor", "Lead"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Flexible Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Flexible Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Flexible Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Good to Go" },

      { userId: "1", displayName: "A", songTitle: "Exact Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Exact Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Exact Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Exact Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "Good to Go" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Flexible Song");
    expect(matches[0].score - matches[1].score).toBeLessThan(10);
  });

  it("penalizes confidence warnings but not arrangement notes when ranking", () => {
    const entries: SingerEntry[] = [
      { userId: "1", displayName: "A", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "Two", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Conflict Song", voicing: "TTBB", arrangerName: "One", partsKnown: ["Bass"], confidence: "Good to Go" },

      { userId: "1", displayName: "A", songTitle: "Confidence Song", voicing: "TTBB", partsKnown: ["Tenor"], confidence: "Good to Go" },
      { userId: "2", displayName: "B", songTitle: "Confidence Song", voicing: "TTBB", partsKnown: ["Lead"], confidence: "Good to Go" },
      { userId: "3", displayName: "C", songTitle: "Confidence Song", voicing: "TTBB", partsKnown: ["Baritone"], confidence: "Good to Go" },
      { userId: "4", displayName: "D", songTitle: "Confidence Song", voicing: "TTBB", partsKnown: ["Bass"], confidence: "A Little Rusty" },
    ];

    const matches = findMatches(entries);

    expect(matches[0].songTitle).toBe("Conflict Song");
    expect(matches[0].category).toBe("ready");
    expect(matches[0].warnings).toContain(arrangementCheckNote);
    expect(matches[1].warnings[0]).toMatch(/^Confidence warning:/);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });
});
