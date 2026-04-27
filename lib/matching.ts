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
  | "Good to Go"
  | "A Little Rusty"
  | "Music Required";

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
  score: number;
};

export function requiredPartsForVoicing(voicing: Voicing): Part[] {
  if (voicing === "TTBB") return ["Tenor", "Lead", "Baritone", "Bass"];
  if (voicing === "SATB") return ["Soprano", "Alto", "Tenor", "Bass"];
  return ["Soprano 1", "Soprano 2", "Alto 1", "Alto 2"];
}

export function normalizeConfidence(confidence?: string | null): Confidence | null {
  if (confidence === "Good to Go") return "Good to Go";
  if (confidence === "A Little Rusty") return "A Little Rusty";
  if (confidence === "Music Required") return "Music Required";

  if (confidence === "Performance ready" || confidence === "Solid") {
    return "Good to Go";
  }

  if (confidence === "Needs review" || confidence === "Rusty") {
    return "A Little Rusty";
  }

  if (confidence === "Learning") return "Music Required";

  return null;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function confidenceValue(confidence?: string | null): number {
  const normalizedConfidence = normalizeConfidence(confidence);

  if (normalizedConfidence === "Good to Go") return 5;
  if (normalizedConfidence === "A Little Rusty") return 2;
  if (normalizedConfidence === "Music Required") return 0;
  return 3;
}

function confidenceWarning(entries: SingerEntry[]): string | null {
  const weak = entries.filter((e) => {
    const normalizedConfidence = normalizeConfidence(e.confidence);
    return (
      normalizedConfidence === "A Little Rusty" ||
      normalizedConfidence === "Music Required"
    );
  });

  if (!weak.length) return null;

  return `Confidence warning: ${weak
    .map((e) => `${e.displayName} marked ${normalizeConfidence(e.confidence)}`)
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

    const candidates = entries
      .filter((entry) => entry.partsKnown.includes(part) && !usedSingerIds.has(entry.userId))
      .sort((a, b) => confidenceValue(b.confidence) - confidenceValue(a.confidence));

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

function scoreMatch(
  category: MatchResult["category"],
  assignment: Record<Part, SingerEntry>,
  group: SingerEntry[],
  requiredParts: Part[],
  warnings: string[]
): number {
  // Keep category bands wide so a weaker ready match still beats any possible
  // match, and any possible match still beats a one-part-missing result.
  const categoryBase = {
    ready: 3000,
    possible: 2000,
    one_part_missing: 1000,
  }[category];

  const assignedConfidence = Object.values(assignment).reduce(
    (sum, entry) => sum + confidenceValue(entry.confidence),
    0
  );

  // Flexibility is backup coverage: additional singers who can cover required
  // parts. It is useful in real pickup quartets, but stays a small tie-breaker.
  const flexibility = requiredParts.reduce((sum, part) => {
    const coverage = group.filter((entry) => entry.partsKnown.includes(part)).length;
    return sum + Math.max(0, coverage - 1);
  }, 0);

  const warningPenalty = warnings.reduce((sum, warning) => {
    if (warning === "Possible arranger conflict.") return sum + 50;
    if (warning.startsWith("Confidence warning:")) return sum + 30;
    return sum + 20;
  }, 0);

  return categoryBase + assignedConfidence * 20 + flexibility * 2 - warningPenalty;
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
        score: scoreMatch(category, fullAssignment, group, requiredParts, warnings),
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
        score: scoreMatch(
          "one_part_missing",
          bestNearMatch.assignment,
          group,
          requiredParts,
          warnings
        ),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
