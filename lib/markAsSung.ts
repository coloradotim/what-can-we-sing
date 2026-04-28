import type { MatchResult, SingerEntry } from "@/lib/matching";

export type MarkAsSungResolution =
  | {
      status: "ready";
      repertoireId: string;
      entry: SingerEntry;
    }
  | {
      status: "no_matching_entry";
    }
  | {
      status: "missing_repertoire_id";
    }
  | {
      status: "ambiguous";
      repertoireIds: string[];
    };

export function resolveCurrentUserRepertoireForMarkAsSung(
  match: MatchResult,
  currentUserId: string
): MarkAsSungResolution {
  const userEntries = Object.values(match.assignments)
    .flat()
    .filter((entry) => entry.userId === currentUserId);

  if (userEntries.length === 0) {
    return { status: "no_matching_entry" };
  }

  const entriesByRepertoireId = new Map<string, SingerEntry>();
  let hasMissingRepertoireId = false;

  for (const entry of userEntries) {
    if (!entry.repertoireId) {
      hasMissingRepertoireId = true;
      continue;
    }

    entriesByRepertoireId.set(entry.repertoireId, entry);
  }

  if (entriesByRepertoireId.size === 1 && !hasMissingRepertoireId) {
    const [repertoireId, entry] = Array.from(entriesByRepertoireId.entries())[0];
    return { status: "ready", repertoireId, entry };
  }

  if (entriesByRepertoireId.size > 1) {
    return {
      status: "ambiguous",
      repertoireIds: Array.from(entriesByRepertoireId.keys()).sort(),
    };
  }

  return { status: "missing_repertoire_id" };
}
