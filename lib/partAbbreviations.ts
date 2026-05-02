import type { Part, Voicing } from "@/lib/matching";

export const functionalPartNames = [
  "Tenor",
  "Lead",
  "Baritone",
  "Bass",
] as const;

export type FunctionalPartName = (typeof functionalPartNames)[number];

export const voicingDisplayLabels: Record<Voicing, string> = {
  SSAA: "Treble (SSAA)",
  SATB: "Mixed (SATB)",
  TTBB: "Lower voice (TTBB)",
};

export const compactVoicingDisplayLabels: Record<Voicing, string> = {
  SSAA: "Treble",
  SATB: "Mixed",
  TTBB: "Lower voice",
};

export const printedNotationSummaries: Record<Voicing, string> = {
  SSAA: "S1 = T, S2 = L, A1 = Bari, A2 = Bass",
  SATB: "Soprano = T, Alto = L, Tenor = Bari, Bass = Bass",
  TTBB: "T1 = T, T2 = L, B1 = Bari, B2 = Bass",
};

const functionalPartLabels: Record<
  Voicing,
  Partial<Record<Part, FunctionalPartName>>
> = {
  TTBB: {
    Tenor: "Tenor",
    Lead: "Lead",
    Baritone: "Baritone",
    Bass: "Bass",
  },
  SATB: {
    Soprano: "Tenor",
    Alto: "Lead",
    Tenor: "Baritone",
    Bass: "Bass",
  },
  SSAA: {
    "Soprano 1": "Tenor",
    "Soprano 2": "Lead",
    "Alto 1": "Baritone",
    "Alto 2": "Bass",
  },
};

export function voicingDisplayLabel(voicing: Voicing): string {
  return voicingDisplayLabels[voicing];
}

export function compactVoicingDisplayLabel(voicing: Voicing): string {
  return compactVoicingDisplayLabels[voicing];
}

export function printedNotationSummary(voicing: Voicing): string {
  return printedNotationSummaries[voicing];
}

export function functionalPartName(
  voicing: Voicing,
  part: Part
): string {
  return functionalPartLabels[voicing][part] ?? part;
}

export function partAbbreviation(voicing: Voicing, part: Part): string {
  const functionalPart = functionalPartName(voicing, part);

  if (functionalPart === "Tenor") return "T";
  if (functionalPart === "Lead") return "L";
  if (functionalPart === "Baritone") return "Bari";
  if (functionalPart === "Bass") return "Bass";

  return functionalPart;
}

export function partButtonLabel(voicing: Voicing, part: Part): string {
  const abbreviation = partAbbreviation(voicing, part);
  const displayName = functionalPartName(voicing, part);

  if (abbreviation === displayName) return displayName;
  return `${abbreviation} ${displayName}`;
}
