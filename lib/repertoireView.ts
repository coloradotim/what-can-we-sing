import type { Part, Voicing } from "@/lib/matching";
import type { RepertoireRow } from "@/lib/repertoireStore";

export type RepertoireSortOption =
  | "title_asc"
  | "created_desc"
  | "created_asc"
  | "last_sung_desc"
  | "last_sung_asc";

export type RepertoireFilters = {
  searchQuery: string;
  voicing: Voicing | "";
  part: Part | "";
  neverSungOnly: boolean;
  sort: RepertoireSortOption;
};

function normalizedText(value: string) {
  return value.trim().toLowerCase();
}

function compareTitles(a: RepertoireRow, b: RepertoireRow) {
  return a.song_title.localeCompare(b.song_title, undefined, {
    sensitivity: "base",
  });
}

function timestampValue(value: string | null | undefined) {
  return value ? new Date(value).getTime() : null;
}

function compareNullableDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: "asc" | "desc",
  nulls: "first" | "last"
) {
  const aTime = timestampValue(a);
  const bTime = timestampValue(b);

  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return nulls === "first" ? -1 : 1;
  if (bTime === null) return nulls === "first" ? 1 : -1;

  return direction === "asc" ? aTime - bTime : bTime - aTime;
}

export function filterAndSortRepertoire(
  items: RepertoireRow[],
  filters: RepertoireFilters
) {
  const query = normalizedText(filters.searchQuery);

  return items
    .filter((item) => {
      if (query && !normalizedText(item.song_title).includes(query)) {
        return false;
      }

      if (filters.voicing && item.voicing !== filters.voicing) {
        return false;
      }

      if (
        filters.part &&
        !item.part_confidences.some(({ part }) => part === filters.part)
      ) {
        return false;
      }

      if (filters.neverSungOnly && item.last_sung_at) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "created_desc") {
        return (
          compareNullableDates(a.created_at, b.created_at, "desc", "last") ||
          compareTitles(a, b)
        );
      }

      if (filters.sort === "created_asc") {
        return (
          compareNullableDates(a.created_at, b.created_at, "asc", "last") ||
          compareTitles(a, b)
        );
      }

      if (filters.sort === "last_sung_desc") {
        return (
          compareNullableDates(a.last_sung_at, b.last_sung_at, "desc", "last") ||
          compareTitles(a, b)
        );
      }

      if (filters.sort === "last_sung_asc") {
        return (
          compareNullableDates(a.last_sung_at, b.last_sung_at, "asc", "first") ||
          compareTitles(a, b)
        );
      }

      return compareTitles(a, b);
    });
}

export function hasActiveRepertoireFilters(filters: RepertoireFilters) {
  return Boolean(
    filters.searchQuery.trim() ||
      filters.voicing ||
      filters.part ||
      filters.neverSungOnly
  );
}
