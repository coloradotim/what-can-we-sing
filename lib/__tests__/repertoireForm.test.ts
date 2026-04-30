import { describe, expect, it } from "vitest";
import {
  hasDuplicateParts,
  isRepertoireSongFormValid,
  rowHasMissingPartOrConfidence,
  type PartConfidenceFormRow,
} from "../repertoireForm";

const completeRows: PartConfidenceFormRow[] = [
  { part: "Lead", confidence: "Good to Go" },
];

describe("repertoire song form validation", () => {
  it("requires title, voicing, part, and confidence", () => {
    expect(isRepertoireSongFormValid("Hello Mary Lou", "TTBB", completeRows)).toBe(
      true
    );
    expect(isRepertoireSongFormValid("", "TTBB", completeRows)).toBe(false);
    expect(isRepertoireSongFormValid("Hello Mary Lou", "", completeRows)).toBe(
      false
    );
    expect(
      isRepertoireSongFormValid("Hello Mary Lou", "TTBB", [
        { part: "", confidence: "" },
      ])
    ).toBe(false);
  });

  it("keeps the form invalid after changing voicing clears required part fields", () => {
    const clearedByVoicingChange: PartConfidenceFormRow[] = [
      { part: "", confidence: "" },
    ];

    expect(
      rowHasMissingPartOrConfidence(clearedByVoicingChange)
    ).toBe(true);
    expect(
      isRepertoireSongFormValid(
        "Hello Mary Lou",
        "SATB",
        clearedByVoicingChange
      )
    ).toBe(false);
  });

  it("treats duplicate selected parts as invalid", () => {
    const duplicateRows: PartConfidenceFormRow[] = [
      { part: "Lead", confidence: "Good to Go" },
      { part: "Lead", confidence: "A Little Rusty" },
    ];

    expect(hasDuplicateParts(duplicateRows)).toBe(true);
    expect(isRepertoireSongFormValid("Hello Mary Lou", "TTBB", duplicateRows)).toBe(
      false
    );
  });
});
