import type { Voicing } from "@/lib/matching";
import { arrangerDisplayName } from "./arrangerDisplay";

export type SongSuggestionSource = {
  song_title: string;
  voicing: string;
  arranger_name: string | null;
};

export type SongSuggestion = {
  songTitle: string;
  arrangerName: string;
  voicings: Voicing[];
};

export function songSuggestionArrangerLabel(suggestion: SongSuggestion) {
  return arrangerDisplayName(suggestion.arrangerName);
}

export function songSuggestionSubtitle(suggestion: SongSuggestion) {
  return `${songSuggestionArrangerLabel(suggestion)} · ${suggestion.voicings.join(
    ", "
  )}`;
}

const validVoicings: Voicing[] = ["TTBB", "SATB", "SSAA"];

function isVoicing(value: string): value is Voicing {
  return validVoicings.includes(value as Voicing);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function suggestionKey(
  suggestion: Pick<SongSuggestion, "songTitle" | "arrangerName">
) {
  return [
    normalizeSearchText(suggestion.songTitle),
    normalizeSearchText(suggestion.arrangerName),
  ].join(":");
}

function preferredTitle(current: string, next: string) {
  if (next.length > current.length) return next;
  if (next.length < current.length) return current;
  return current.localeCompare(next) <= 0 ? current : next;
}

export function getSongSuggestions(
  rows: SongSuggestionSource[],
  query: string,
  limit = 6
): SongSuggestion[] {
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery.length < 2) return [];

  const suggestions = new Map<string, SongSuggestion>();

  for (const row of rows) {
    if (!isVoicing(row.voicing)) continue;

    const suggestion = {
      songTitle: row.song_title.trim(),
      voicing: row.voicing,
      arrangerName: row.arranger_name?.trim() ?? "",
    };

    if (!suggestion.songTitle) continue;

    const normalizedTitle = normalizeSearchText(suggestion.songTitle);
    const normalizedArranger = normalizeSearchText(suggestion.arrangerName);

    if (
      !normalizedTitle.includes(normalizedQuery) &&
      !normalizedArranger.includes(normalizedQuery)
    ) {
      continue;
    }

    const key = suggestionKey(suggestion);
    const existing = suggestions.get(key);

    if (existing) {
      existing.songTitle = preferredTitle(
        existing.songTitle,
        suggestion.songTitle
      );
      if (!existing.voicings.includes(suggestion.voicing)) {
        existing.voicings.push(suggestion.voicing);
      }
      continue;
    }

    suggestions.set(key, {
      songTitle: suggestion.songTitle,
      arrangerName: suggestion.arrangerName,
      voicings: [suggestion.voicing],
    });
  }

  return Array.from(suggestions.values())
    .map((suggestion) => ({
      ...suggestion,
      voicings: validVoicings.filter((voicing) =>
        suggestion.voicings.includes(voicing)
      ),
    }))
    .sort((a, b) => {
      const titleComparison = a.songTitle.localeCompare(b.songTitle);
      if (titleComparison !== 0) return titleComparison;

      const arrangerComparison = a.arrangerName.localeCompare(b.arrangerName);
      if (arrangerComparison !== 0) return arrangerComparison;

      const voicingComparison = a.voicings
        .join(",")
        .localeCompare(b.voicings.join(","));
      if (voicingComparison !== 0) return voicingComparison;

      return 0;
    })
    .slice(0, limit);
}
