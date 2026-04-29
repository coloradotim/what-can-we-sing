export const noArrangerEnteredLabel = "No arranger entered";

export function arrangerDisplayName(arrangerName?: string | null) {
  const trimmed = arrangerName?.trim();
  return trimmed || noArrangerEnteredLabel;
}

export function hasArrangerEntered(arrangerName?: string | null) {
  return Boolean(arrangerName?.trim());
}

export function normalizeArrangerName(arrangerName: string) {
  return arrangerName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ");
}

type ArrangerNameParts = {
  first: string | null;
  last: string;
};

function arrangerNameParts(arrangerName: string): ArrangerNameParts | null {
  const normalized = normalizeArrangerName(arrangerName);
  if (!normalized) return null;

  const parts = normalized.split(" ").filter(Boolean);
  const last = parts.at(-1);
  if (!last) return null;

  return {
    first: parts.length > 1 ? parts[0] : null,
    last,
  };
}

function firstNamesAreCompatible(first: string | null, second: string | null) {
  if (!first || !second) return true;
  if (first === second) return true;

  return first[0] === second[0] && (first.length === 1 || second.length === 1);
}

export function areLikelySameArranger(
  firstArrangerName: string,
  secondArrangerName: string
) {
  const first = arrangerNameParts(firstArrangerName);
  const second = arrangerNameParts(secondArrangerName);

  if (!first || !second) return false;
  if (
    normalizeArrangerName(firstArrangerName) ===
    normalizeArrangerName(secondArrangerName)
  ) {
    return true;
  }

  return (
    first.last === second.last &&
    firstNamesAreCompatible(first.first, second.first)
  );
}

export function areLikelySameArrangerGroup(arrangerNames: string[]) {
  if (arrangerNames.length <= 1) return true;

  for (let i = 0; i < arrangerNames.length; i += 1) {
    for (let j = i + 1; j < arrangerNames.length; j += 1) {
      if (!areLikelySameArranger(arrangerNames[i], arrangerNames[j])) {
        return false;
      }
    }
  }

  return true;
}
