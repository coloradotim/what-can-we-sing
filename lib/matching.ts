export type Voicing = "TTBB" | "SATB" | "SSAA";

export type Part =
  | "Tenor"
  | "Lead"
  | "Baritone"
  | "Bass"
  | "Soprano"
  | "Alto"
  | "Soprano 1"
  | "Soprano 2"
  | "Alto 1"
  | "Alto 2";

export type Confidence =
  | "Performance ready"
  | "Solid"
  | "Needs review"
  | "Rusty"
  | "Learning";

export type SingerEntry = {
  userId: string;
  displayName: string;
  songTitle: string;
  voicing: Voicing;
  arrangerName?: string | null;
  partsKnown: Part[];
  confidence?: Confidence | null;
};

export type MatchResult = {
  songTitle: string;
  voicing: Voicing;
  arrangerNames: string[];
  category: "ready" | "possible" | "one_part_missing";
  missingParts: Part[];
  assignments: Partial<Record<Part, SingerEntry[]>>;
  warnings: string[];
};

export function requiredPartsForVoicing(voicing: Voicing): Part[] {
  if (voicing === "TTBB") return ["Tenor", "Lead", "Baritone", "Bass"];
  if (voicing === "SATB") return ["Soprano", "Alto", "Tenor", "Bass"];
  return ["Soprano 1", "Soprano 2", "Alto 1", "Alto 2"];
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function confidenceWarning(entries: SingerEntry[]): string | null {
  const weak = entries.filter((e) =>
    ["Needs review", "Rusty", "Learning"].includes(e.confidence ?? "")
  );

  if (!weak.length) return null;

  return `Confidence warning: ${weak
    .map((e) => `${e.displayName} marked ${e.confidence}`)
    .join(", ")}`;
}

function findDistinctAssignment(
  parts: Part[],
  entries: SingerEntry[]
): Record<Part, SingerEntry> | null {
  const assignment = {} as Record<Part, SingerEntry>;
  const usedSingerIds = new Set<string>();

  const sortedParts = [...parts].sort((a, b) => {
    const aOptions = entries.filter((entry) => entry.partsKnown.includes(a)).length;
    const bOptions = entries.filter((entry) => entry.partsKnown.includes(b)).length;
    return aOptions - bOptions;
  });

  function backtrack(index: number): boolean {
    if (index === sortedParts.length) return true;

    const part = sortedParts[index];

    const candidates = entries.filter(
      (entry) => entry.partsKnown.includes(part) && !usedSingerIds.has(entry.userId)
    );

    for (const candidate of candidates) {
      assignment[part] = candidate;
      usedSingerIds.add(candidate.userId);

      if (backtrack(index + 1)) return true;

      delete assignment[part];
      usedSingerIds.delete(candidate.userId);
    }

    return false;
  }

  return backtrack(0) ? assignment : null;
}

function buildAssignments(
  assignment: Record<Part, SingerEntry>
): Partial<Record<Part, SingerEntry[]>> {
  const result: Partial<Record<Part, SingerEntry[]>> = {};

  for (const [part, entry] of Object.entries(assignment)) {
    result[part as Part] = [entry];
  }

  return result;
}

export function findMatches(entries: SingerEntry[]): MatchResult[] {
  const groups = new Map<string, SingerEntry[]>();

  for (const entry of entries) {
    const key = `${normalizeTitle(entry.songTitle)}::${entry.voicing}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const results: MatchResult[] = [];

  for (const group of groups.values()) {
    const { songTitle, voicing } = group[0];
    const requiredParts = requiredPartsForVoicing(voicing);

    const fullAssignment = findDistinctAssignment(requiredParts, group);

    const knownArrangers = Array.from(
      new Set(
        group
          .map((e) => e.arrangerName?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );

    const hasMissingArranger = group.some((e) => !e.arrangerName);
    const hasArrangerConflict = knownArrangers.length > 1;

    const warnings: string[] = [];

    if (hasMissingArranger) warnings.push("Arranger missing for at least one singer.");
    if (hasArrangerConflict) warnings.push("Possible arranger conflict.");

    const confidence = confidenceWarning(group);
    if (confidence) warnings.push(confidence);

    if (fullAssignment) {
      const category: MatchResult["category"] =
        hasMissingArranger || hasArrangerConflict ? "possible" : "ready";

      results.push({
        songTitle,
        voicing,
        arrangerNames: knownArrangers,
        category,
        missingParts: [],
        assignments: buildAssignments(fullAssignment),
        warnings,
      });

      continue;
    }

    let bestNearMatch:
      | {
          missingPart: Part;
          assignment: Record<Part, SingerEntry>;
        }
      | null = null;

    for (const omittedPart of requiredParts) {
      const remainingParts = requiredParts.filter((part) => part !== omittedPart);
      const partialAssignment = findDistinctAssignment(remainingParts, group);

      if (partialAssignment) {
        bestNearMatch = {
          missingPart: omittedPart,
          assignment: partialAssignment,
        };
        break;
      }
    }

    if (bestNearMatch) {
      results.push({
        songTitle,
        voicing,
        arrangerNames: knownArrangers,
        category: "one_part_missing",
        missingParts: [bestNearMatch.missingPart],
        assignments: buildAssignments(bestNearMatch.assignment),
        warnings,
      });
    }
  }

  return results.sort((a, b) => {
    const order = { ready: 0, possible: 1, one_part_missing: 2 };
    return order[a.category] - order[b.category];
  });
}