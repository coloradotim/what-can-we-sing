import { isLikelySameSongTitle } from "./fuzzySongTitles";

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

export type PartConfidence = {
  part: Part;
  confidence: Confidence;
};

export type PartConfidenceMap = Partial<Record<Part, Confidence>>;

export type SingerEntry = {
  userId: string;
  displayName: string;
  songTitle: string;
  voicing: Voicing;
  arrangerName?: string | null;
  partsKnown: Part[];
  confidence?: Confidence | null;
  partConfidences?: PartConfidenceMap | null;
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

export const arrangementCheckNote =
  "Consider double-checking that everyone is singing the same arrangement.";

export function possibleSameSongNote(firstTitle: string, secondTitle: string) {
  return `Possible same song: Is "${firstTitle}" the same as "${secondTitle}"?`;
}

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

export function confidenceForPart(
  entry: SingerEntry,
  part: Part
): Confidence | null {
  return (
    normalizeConfidence(entry.partConfidences?.[part]) ??
    normalizeConfidence(entry.confidence)
  );
}

function confidenceValueForPart(entry: SingerEntry, part: Part): number {
  return confidenceValue(confidenceForPart(entry, part));
}

function confidenceWarning(
  assignment: Record<Part, SingerEntry>
): string | null {
  const weak = Object.entries(assignment).filter(([part, entry]) => {
    const normalizedConfidence = confidenceForPart(entry, part as Part);
    return (
      normalizedConfidence === "A Little Rusty" ||
      normalizedConfidence === "Music Required"
    );
  });

  if (!weak.length) return null;

  return `Confidence warning: ${weak
    .map(([part, entry]) => {
      const normalizedConfidence = confidenceForPart(entry, part as Part);
      return `${entry.displayName} marked ${normalizedConfidence} on ${part}`;
    })
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
      .sort(
        (a, b) =>
          confidenceValueForPart(b, part) - confidenceValueForPart(a, part)
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
    (sum, entry) => {
      const assignedPart = Object.entries(assignment).find(
        ([, assignedEntry]) => assignedEntry === entry
      )?.[0] as Part | undefined;

      return assignedPart
        ? sum + confidenceValueForPart(entry, assignedPart)
        : sum;
    },
    0
  );

  // Flexibility is backup coverage: additional singers who can cover required
  // parts. It is useful in real pickup quartets, but stays a small tie-breaker.
  const flexibility = requiredParts.reduce((sum, part) => {
    const coverage = group.filter((entry) => entry.partsKnown.includes(part)).length;
    return sum + Math.max(0, coverage - 1);
  }, 0);

  const warningPenalty = warnings.reduce((sum, warning) => {
    if (warning.startsWith("Confidence warning:")) return sum + 30;
    return sum;
  }, 0);

  return categoryBase + assignedConfidence * 20 + flexibility * 2 - warningPenalty;
}

function knownArrangersForGroup(group: SingerEntry[]) {
  return Array.from(
    new Set(
      group
        .map((e) => e.arrangerName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );
}

function arrangementWarningsForGroup(
  group: SingerEntry[],
  knownArrangers: string[]
) {
  const hasSomeMissingArranger =
    knownArrangers.length > 0 && group.some((e) => !e.arrangerName?.trim());
  const hasMultipleArrangers = knownArrangers.length > 1;

  return hasSomeMissingArranger || hasMultipleArrangers
    ? [arrangementCheckNote]
    : [];
}

function preferredSuggestionTitle(firstTitle: string, secondTitle: string) {
  if (secondTitle.length > firstTitle.length) return secondTitle;
  if (firstTitle.length > secondTitle.length) return firstTitle;

  return firstTitle.localeCompare(secondTitle, undefined, {
    sensitivity: "base",
  }) <= 0
    ? firstTitle
    : secondTitle;
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
    const knownArrangers = knownArrangersForGroup(group);
    const warnings = arrangementWarningsForGroup(group, knownArrangers);

    if (fullAssignment) {
      const confidence = confidenceWarning(fullAssignment);
      if (confidence) warnings.push(confidence);

      results.push({
        songTitle,
        voicing,
        arrangerNames: knownArrangers,
        category: "ready",
        missingParts: [],
        assignments: buildAssignments(fullAssignment),
        warnings,
        score: scoreMatch("ready", fullAssignment, group, requiredParts, warnings),
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
      const confidence = confidenceWarning(bestNearMatch.assignment);
      if (confidence) warnings.push(confidence);

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

  const exactGroups = Array.from(groups.values());
  const possibleSuggestionKeys = new Set<string>();

  for (let i = 0; i < exactGroups.length; i += 1) {
    for (let j = i + 1; j < exactGroups.length; j += 1) {
      const firstGroup = exactGroups[i];
      const secondGroup = exactGroups[j];
      const first = firstGroup[0];
      const second = secondGroup[0];

      if (first.voicing !== second.voicing) continue;
      if (!isLikelySameSongTitle(first.songTitle, second.songTitle)) continue;

      const group = [...firstGroup, ...secondGroup];
      const requiredParts = requiredPartsForVoicing(first.voicing);
      const fullAssignment = findDistinctAssignment(requiredParts, group);

      if (!fullAssignment) continue;

      const suggestionKey = [
        first.voicing,
        normalizeTitle(first.songTitle),
        normalizeTitle(second.songTitle),
      ]
        .sort()
        .join(":");

      if (possibleSuggestionKeys.has(suggestionKey)) continue;
      possibleSuggestionKeys.add(suggestionKey);

      const knownArrangers = knownArrangersForGroup(group);
      const warnings = [
        possibleSameSongNote(first.songTitle, second.songTitle),
        ...arrangementWarningsForGroup(group, knownArrangers),
      ];
      const confidence = confidenceWarning(fullAssignment);
      if (confidence) warnings.push(confidence);

      results.push({
        songTitle: preferredSuggestionTitle(first.songTitle, second.songTitle),
        voicing: first.voicing,
        arrangerNames: knownArrangers,
        category: "possible",
        missingParts: [],
        assignments: buildAssignments(fullAssignment),
        warnings,
        score: scoreMatch("possible", fullAssignment, group, requiredParts, warnings),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
