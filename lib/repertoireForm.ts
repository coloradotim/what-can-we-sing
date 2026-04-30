import type { Confidence, Part, Voicing } from "@/lib/matching";

export type PartConfidenceFormRow = {
  part: Part | "";
  confidence: Confidence | "";
};

export function hasDuplicateParts(rows: PartConfidenceFormRow[]) {
  const selectedParts = rows
    .map((row) => row.part)
    .filter((part): part is Part => Boolean(part));
  return new Set(selectedParts).size !== selectedParts.length;
}

export function rowHasMissingPartOrConfidence(rows: PartConfidenceFormRow[]) {
  return rows.some((row) => !row.part || !row.confidence);
}

export function isRepertoireSongFormValid(
  songTitle: string,
  voicing: Voicing | "",
  rows: PartConfidenceFormRow[]
) {
  return (
    Boolean(songTitle.trim()) &&
    Boolean(voicing) &&
    rows.length > 0 &&
    !rowHasMissingPartOrConfidence(rows) &&
    !hasDuplicateParts(rows)
  );
}
