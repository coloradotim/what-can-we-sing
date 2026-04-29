import { describe, expect, it } from "vitest";
import type { MatchResult } from "../matching";
import { resolveCurrentUserRepertoireForMarkAsSung } from "../markAsSung";

function match(assignments: MatchResult["assignments"]): MatchResult {
  return {
    songTitle: "Test Song",
    voicing: "TTBB",
    arrangerNames: [],
    hasMissingArrangerInfo: false,
    category: "ready",
    missingParts: [],
    assignments,
    warnings: [],
    score: 1,
  };
}

describe("resolveCurrentUserRepertoireForMarkAsSung", () => {
  it("resolves the current user's assigned repertoire row", () => {
    const result = resolveCurrentUserRepertoireForMarkAsSung(
      match({
        Tenor: [
          {
            repertoireId: "rep-1",
            userId: "current-user",
            displayName: "Current",
            songTitle: "Test Song",
            voicing: "TTBB",
            partsKnown: ["Tenor"],
          },
        ],
        Lead: [
          {
            repertoireId: "rep-2",
            userId: "other-user",
            displayName: "Other",
            songTitle: "Test Song",
            voicing: "TTBB",
            partsKnown: ["Lead"],
          },
        ],
      }),
      "current-user"
    );

    expect(result).toMatchObject({
      status: "ready",
      repertoireId: "rep-1",
    });
  });

  it("does not resolve another singer's repertoire row", () => {
    const result = resolveCurrentUserRepertoireForMarkAsSung(
      match({
        Lead: [
          {
            repertoireId: "rep-2",
            userId: "other-user",
            displayName: "Other",
            songTitle: "Test Song",
            voicing: "TTBB",
            partsKnown: ["Lead"],
          },
        ],
      }),
      "current-user"
    );

    expect(result).toEqual({ status: "no_matching_entry" });
  });

  it("does not mark ambiguous current-user entries", () => {
    const result = resolveCurrentUserRepertoireForMarkAsSung(
      match({
        Tenor: [
          {
            repertoireId: "rep-1",
            userId: "current-user",
            displayName: "Current",
            songTitle: "Test Song",
            voicing: "TTBB",
            partsKnown: ["Tenor"],
          },
        ],
        Lead: [
          {
            repertoireId: "rep-2",
            userId: "current-user",
            displayName: "Current",
            songTitle: "Test Song",
            voicing: "TTBB",
            partsKnown: ["Lead"],
          },
        ],
      }),
      "current-user"
    );

    expect(result).toEqual({
      status: "ambiguous",
      repertoireIds: ["rep-1", "rep-2"],
    });
  });

  it("requires a repertoire row id before updating", () => {
    const result = resolveCurrentUserRepertoireForMarkAsSung(
      match({
        Bass: [
          {
            userId: "current-user",
            displayName: "Current",
            songTitle: "Test Song",
            voicing: "TTBB",
            partsKnown: ["Bass"],
          },
        ],
      }),
      "current-user"
    );

    expect(result).toEqual({ status: "missing_repertoire_id" });
  });
});
