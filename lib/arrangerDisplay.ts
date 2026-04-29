export const noArrangerEnteredLabel = "No arranger entered";

export function arrangerDisplayName(arrangerName?: string | null) {
  const trimmed = arrangerName?.trim();
  return trimmed || noArrangerEnteredLabel;
}

export function hasArrangerEntered(arrangerName?: string | null) {
  return Boolean(arrangerName?.trim());
}
