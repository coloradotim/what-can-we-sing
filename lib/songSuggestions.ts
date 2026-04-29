import type { Voicing } from "@/lib/matching";
import { arrangerDisplayName } from "./arrangerDisplay";

export type SongSuggestionSource = {
  song_title: string;
  voicing: string;
  arranger_name: string | null;
};

export type SongSuggestion = {
  songTitle: string;
  voicing: Voicing;
  arrangerName: string;
};

export function songSuggestionArrangerLabel(suggestion: SongSuggestion) {
  return arrangerDisplayName(suggestion.arrangerName);
}

export function songSuggestionSubtitle(suggestion: SongSuggestion) {
  return `${suggestion.voicing} · ${songSuggestionArrangerLabel(suggestion)}`;
}

const validVoicings: Voicing[] = ["TTBB", "SATB", "SSAA"];

function isVoicing(value: string): value is Voicing {
  return validVoicings.includes(value as Voicing);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function suggestionKey(suggestion: SongSuggestion) {
  return [
    normalizeSearchText(suggestion.songTitle),
    suggestion.voicing,
    normalizeSearchText(suggestion.arrangerName),
  ].join(":");
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

    suggestions.set(suggestionKey(suggestion), suggestion);
  }

  return Array.from(suggestions.values())
    .sort((a, b) => {
      const titleComparison = a.songTitle.localeCompare(b.songTitle);
      if (titleComparison !== 0) return titleComparison;

      const voicingComparison = a.voicing.localeCompare(b.voicing);
      if (voicingComparison !== 0) return voicingComparison;

      return a.arrangerName.localeCompare(b.arrangerName);
    })
    .slice(0, limit);
}
