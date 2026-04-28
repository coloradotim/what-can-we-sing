import { describe, expect, it } from "vitest";
import { buildParticipantEntries } from "../participantEntries";
import type { RepertoireRow } from "../repertoireStore";

function repertoireRow(
  overrides: Partial<RepertoireRow> = {}
): RepertoireRow {
  return {
    id: "rep-1",
    user_id: "user-1",
    song_title: "Bright Was the Night",
    voicing: "TTBB",
    arranger_name: "A. Arranger",
    parts_known: ["Lead", "Bass"],
    part_confidences: [
      { part: "Lead", confidence: "Good To Go" },
      { part: "Bass", confidence: "Music Required" },
    ],
    confidence: "Good To Go",
    notes: "private note",
    last_sung_at: null,
    times_sung_count: 0,
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildParticipantEntries", () => {
  it("builds participant snapshots from repertoire rows", () => {
    expect(buildParticipantEntries("Tim", [repertoireRow()])).toEqual([
      {
        repertoireId: "rep-1",
        userId: "user-1",
        displayName: "Tim",
        songTitle: "Bright Was the Night",
        voicing: "TTBB",
        arrangerName: "A. Arranger",
        partsKnown: ["Lead", "Bass"],
        confidence: "Good To Go",
        partConfidences: {
          Lead: "Good To Go",
          Bass: "Music Required",
        },
      },
    ]);
  });

  it("does not include private repertoire notes in participant snapshots", () => {
    const [entry] = buildParticipantEntries("Tim", [
      repertoireRow({ notes: "please do not share" }),
    ]);

    expect(entry).not.toHaveProperty("notes");
  });
});
