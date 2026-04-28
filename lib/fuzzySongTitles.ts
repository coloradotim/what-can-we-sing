import type { Voicing } from "@/lib/matching";

export type FuzzySongTitleItem = {
  id: string;
  songTitle: string;
  voicing: Voicing;
};

export type FuzzySongTitleSuggestion = {
  id: string;
  itemId: string;
  itemTitle: string;
  suggestedItemId: string;
  suggestedTitle: string;
  voicing: Voicing;
};

function normalizeTitleForExactMatch(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleTokens(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function levenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function characterSimilarity(a: string, b: string) {
  const longerLength = Math.max(a.length, b.length);
  if (longerLength === 0) return 1;

  return 1 - levenshteinDistance(a, b) / longerLength;
}

function tokenOverlap(aTokens: string[], bTokens: string[]) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  const shared = [...a].filter((token) => b.has(token)).length;
  const total = new Set([...a, ...b]).size;

  if (total === 0) return 1;
  return shared / total;
}

function isTokenSubset(shorterTokens: string[], longerTokens: string[]) {
  const longer = new Set(longerTokens);
  return shorterTokens.every((token) => longer.has(token));
}

function isLikelySameSongTitle(a: string, b: string) {
  const aCompact = normalizeTitleForExactMatch(a);
  const bCompact = normalizeTitleForExactMatch(b);

  if (!aCompact || !bCompact) return false;
  if (aCompact === bCompact) return false;

  const shorterLength = Math.min(aCompact.length, bCompact.length);
  const longerLength = Math.max(aCompact.length, bCompact.length);
  if (shorterLength < 6) return false;

  if (
    longerLength >= 9 &&
    characterSimilarity(aCompact, bCompact) >= 0.9
  ) {
    return true;
  }

  const aTokens = titleTokens(a);
  const bTokens = titleTokens(b);
  const shorterTokens =
    aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longerTokens = aTokens.length > bTokens.length ? aTokens : bTokens;

  if (
    shorterTokens.length >= 2 &&
    isTokenSubset(shorterTokens, longerTokens) &&
    longerTokens.length - shorterTokens.length <= 2
  ) {
    return true;
  }

  return (
    aTokens.length >= 3 &&
    bTokens.length >= 3 &&
    tokenOverlap(aTokens, bTokens) >= 0.75
  );
}

function canonicalFirstTitle(
  a: FuzzySongTitleItem,
  b: FuzzySongTitleItem
): [FuzzySongTitleItem, FuzzySongTitleItem] {
  if (b.songTitle.length > a.songTitle.length) return [b, a];
  if (a.songTitle.length > b.songTitle.length) return [a, b];

  return a.songTitle.localeCompare(b.songTitle, undefined, {
    sensitivity: "base",
  }) <= 0
    ? [a, b]
    : [b, a];
}

export function findFuzzySongTitleSuggestions(
  items: FuzzySongTitleItem[]
): FuzzySongTitleSuggestion[] {
  const suggestions: FuzzySongTitleSuggestion[] = [];

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const first = items[i];
      const second = items[j];

      if (first.voicing !== second.voicing) continue;
      if (!isLikelySameSongTitle(first.songTitle, second.songTitle)) continue;

      const [canonical, variant] = canonicalFirstTitle(first, second);

      suggestions.push({
        id: [variant.id, canonical.id].sort().join(":"),
        itemId: variant.id,
        itemTitle: variant.songTitle,
        suggestedItemId: canonical.id,
        suggestedTitle: canonical.songTitle,
        voicing: variant.voicing,
      });
    }
  }

  return suggestions.sort((a, b) =>
    a.suggestedTitle.localeCompare(b.suggestedTitle, undefined, {
      sensitivity: "base",
    })
  );
}
