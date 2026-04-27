import type { Part, Voicing } from "@/lib/matching";

export function partAbbreviation(voicing: Voicing, part: Part): string {
  if (voicing === "TTBB") {
    if (part === "Tenor") return "T";
    if (part === "Lead") return "L";
    if (part === "Baritone") return "Bari";
    if (part === "Bass") return "Bass";
  }

  if (voicing === "SATB") {
    if (part === "Soprano") return "S";
    if (part === "Alto") return "A";
    if (part === "Tenor") return "T";
    if (part === "Bass") return "Bass";
  }

  if (part === "Soprano 1") return "S1";
  if (part === "Soprano 2") return "S2";
  if (part === "Alto 1") return "A1";
  if (part === "Alto 2") return "A2";

  return part;
}

export function partButtonLabel(voicing: Voicing, part: Part): string {
  const abbreviation = partAbbreviation(voicing, part);

  if (abbreviation === part) return part;
  return `${abbreviation} ${part}`;
}
