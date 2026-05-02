import { isLikelySameSongTitle } from "./fuzzySongTitles";
import { areLikelySameArrangerGroup } from "./arrangerDisplay";
import { functionalPartName } from "./partAbbreviations";

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
  repertoireId?: string;
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
  hasMissingArrangerInfo: boolean;
  arrangerVariantNote?: string;
  category: "ready" | "possible" | "one_part_missing";
  missingParts: Part[];
  assignments: Partial<Record<Part, SingerEntry[]>>;
  warnings: string[];
  score: number;
  titleMatchType?: "exact" | "fuzzy";
  titleVariants?: MatchTitleVariant[];
};

export type MatchTitleVariant = {
  title: string;
  normalizedTitle: string;
  singers: MatchTitleVariantSinger[];
};

export type MatchTitleVariantSinger = {
  displayName: string;
  part: Part;
  confidence: Confidence | null;
  arrangerName: string | null;
};

export type ConversationStarter = {
  songTitle: string;
  voicing: Voicing;
  arrangerNames: string[];
  hasMissingArrangerInfo: boolean;
  arrangerVariantNote?: string;
  warnings: string[];
  singerCount: number;
  coveredParts: Partial<Record<Part, SingerEntry[]>>;
  missingParts: Part[];
};

type InternalMatchResult = MatchResult & {
  sourceGroupKeys?: string[];
};

export const arrangementCheckNote =
  "Consider double-checking that everyone is singing the same arrangement.";
export const arrangerConflictNote =
  "Different arranger names were entered for this song.";
export function arrangerVariantNote(arrangerNames: string[]) {
  return `Arranger names look similar: ${arrangerNames.join(", ")}. Confirm with the quartet.`;
}

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
  assignment: Record<Part, SingerEntry>,
  voicing: Voicing
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
      return `${entry.displayName} marked ${normalizedConfidence} on ${functionalPartName(
        voicing,
        part as Part
      )}`;
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

function buildCoveredParts(
  requiredParts: Part[],
  entries: SingerEntry[]
): Partial<Record<Part, SingerEntry[]>> {
  const result: Partial<Record<Part, SingerEntry[]>> = {};

  for (const part of requiredParts) {
    const singers = entries.filter((entry) => entry.partsKnown.includes(part));
    if (singers.length > 0) result[part] = singers;
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

function hasMissingArrangerInfo(group: SingerEntry[]) {
  return group.some((e) => !e.arrangerName?.trim());
}

function arrangerVariantNoteForGroup(knownArrangers: string[]) {
  if (knownArrangers.length <= 1) return undefined;
  if (!areLikelySameArrangerGroup(knownArrangers)) return undefined;

  return arrangerVariantNote(knownArrangers);
}

function arrangementWarningsForGroup(knownArrangers: string[]) {
  const hasMultipleArrangers = knownArrangers.length > 1;
  const hasConflictingArrangers =
    hasMultipleArrangers && !areLikelySameArrangerGroup(knownArrangers);

  const warnings = [];

  if (hasConflictingArrangers) warnings.push(arrangerConflictNote);
  if (warnings.length > 0) warnings.push(arrangementCheckNote);

  return warnings;
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

function buildTitleVariants(
  assignment: Record<Part, SingerEntry>
): MatchTitleVariant[] {
  const variants = new Map<string, MatchTitleVariant>();

  for (const [part, entry] of Object.entries(assignment)) {
    const assignedPart = part as Part;
    const existing = variants.get(entry.songTitle);
    const singer = {
      displayName: entry.displayName,
      part: assignedPart,
      confidence: confidenceForPart(entry, assignedPart),
      arrangerName: entry.arrangerName?.trim() || null,
    };

    if (existing) {
      existing.singers.push(singer);
      continue;
    }

    variants.set(entry.songTitle, {
      title: entry.songTitle,
      normalizedTitle: normalizeTitle(entry.songTitle),
      singers: [singer],
    });
  }

  return Array.from(variants.values()).sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );
}

export function findMatches(entries: SingerEntry[]): MatchResult[] {
  const groups = new Map<string, SingerEntry[]>();

  for (const entry of entries) {
    const key = `${normalizeTitle(entry.songTitle)}::${entry.voicing}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const results: InternalMatchResult[] = [];
  const fuzzyFullMatchGroupKeys = new Set<string>();

  for (const [groupKey, group] of groups) {
    const { songTitle, voicing } = group[0];
    const requiredParts = requiredPartsForVoicing(voicing);

    const fullAssignment = findDistinctAssignment(requiredParts, group);
    const knownArrangers = knownArrangersForGroup(group);
    const warnings = arrangementWarningsForGroup(knownArrangers);
    const missingArrangerInfo = hasMissingArrangerInfo(group);
    const arrangerVariant = arrangerVariantNoteForGroup(knownArrangers);

    if (fullAssignment) {
      const confidence = confidenceWarning(fullAssignment, voicing);
      if (confidence) warnings.push(confidence);

      results.push({
        songTitle,
        voicing,
        arrangerNames: knownArrangers,
        hasMissingArrangerInfo: missingArrangerInfo,
        arrangerVariantNote: arrangerVariant,
        category: "ready",
        missingParts: [],
        assignments: buildAssignments(fullAssignment),
        warnings,
        score: scoreMatch("ready", fullAssignment, group, requiredParts, warnings),
        sourceGroupKeys: [groupKey],
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
      const confidence = confidenceWarning(bestNearMatch.assignment, voicing);
      if (confidence) warnings.push(confidence);

      results.push({
        songTitle,
        voicing,
        arrangerNames: knownArrangers,
        hasMissingArrangerInfo: missingArrangerInfo,
        arrangerVariantNote: arrangerVariant,
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
        sourceGroupKeys: [groupKey],
      });
    }
  }

  const exactGroups = Array.from(groups.entries());
  const possibleSuggestionKeys = new Set<string>();

  for (let i = 0; i < exactGroups.length; i += 1) {
    for (let j = i + 1; j < exactGroups.length; j += 1) {
      const [firstGroupKey, firstGroup] = exactGroups[i];
      const [secondGroupKey, secondGroup] = exactGroups[j];
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
      fuzzyFullMatchGroupKeys.add(firstGroupKey);
      fuzzyFullMatchGroupKeys.add(secondGroupKey);

      const knownArrangers = knownArrangersForGroup(group);
      const warnings = [
        possibleSameSongNote(first.songTitle, second.songTitle),
        ...arrangementWarningsForGroup(knownArrangers),
      ];
      const missingArrangerInfo = hasMissingArrangerInfo(group);
      const arrangerVariant = arrangerVariantNoteForGroup(knownArrangers);
      const confidence = confidenceWarning(fullAssignment, first.voicing);
      if (confidence) warnings.push(confidence);

      results.push({
        songTitle: preferredSuggestionTitle(first.songTitle, second.songTitle),
        voicing: first.voicing,
        arrangerNames: knownArrangers,
        hasMissingArrangerInfo: missingArrangerInfo,
        arrangerVariantNote: arrangerVariant,
        category: "possible",
        missingParts: [],
        assignments: buildAssignments(fullAssignment),
        warnings,
        score: scoreMatch("possible", fullAssignment, group, requiredParts, warnings),
        titleMatchType: "fuzzy",
        titleVariants: buildTitleVariants(fullAssignment),
        sourceGroupKeys: [firstGroupKey, secondGroupKey],
      });
    }
  }

  return results
    .filter((match) => {
      if (match.category !== "one_part_missing") return true;

      return !match.sourceGroupKeys?.some((key) =>
        fuzzyFullMatchGroupKeys.has(key)
      );
    })
    .map(({ sourceGroupKeys: _sourceGroupKeys, ...match }) => match)
    .sort((a, b) => b.score - a.score);
}

export function findConversationStarters(
  entries: SingerEntry[]
): ConversationStarter[] {
  const groups = new Map<string, SingerEntry[]>();

  for (const entry of entries) {
    const key = `${normalizeTitle(entry.songTitle)}::${entry.voicing}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const starters: ConversationStarter[] = [];

  for (const group of groups.values()) {
    const { songTitle, voicing } = group[0];
    const requiredParts = requiredPartsForVoicing(voicing);
    const distinctSingerIds = new Set(group.map((entry) => entry.userId));

    if (distinctSingerIds.size < 2) continue;
    if (findDistinctAssignment(requiredParts, group)) continue;

    const hasNearMatch = requiredParts.some((omittedPart) => {
      const remainingParts = requiredParts.filter(
        (part) => part !== omittedPart
      );
      return Boolean(findDistinctAssignment(remainingParts, group));
    });

    if (hasNearMatch) continue;

    const coveredParts = buildCoveredParts(requiredParts, group);
    const missingParts = requiredParts.filter(
      (part) => !coveredParts[part]?.length
    );
    const knownArrangers = knownArrangersForGroup(group);

    starters.push({
      songTitle,
      voicing,
      arrangerNames: knownArrangers,
      hasMissingArrangerInfo: hasMissingArrangerInfo(group),
      arrangerVariantNote: arrangerVariantNoteForGroup(knownArrangers),
      warnings: arrangementWarningsForGroup(knownArrangers),
      singerCount: distinctSingerIds.size,
      coveredParts,
      missingParts,
    });
  }

  return starters.sort((a, b) => {
    const singerDifference = b.singerCount - a.singerCount;
    if (singerDifference !== 0) return singerDifference;

    const coveredDifference =
      Object.keys(b.coveredParts).length - Object.keys(a.coveredParts).length;
    if (coveredDifference !== 0) return coveredDifference;

    return a.songTitle.localeCompare(b.songTitle, undefined, {
      sensitivity: "base",
    });
  });
}
