export function normalizeTitleForDisplay(title: string) {
  const cleaned = title.replace(/\s+/g, " ").trim();
  const articleMatch = cleaned.match(/^(.*),\s*(The|A|An)$/i);

  if (!articleMatch) return cleaned;

  return `${articleMatch[2]} ${articleMatch[1]}`.replace(/\s+/g, " ").trim();
}

export function normalizeSuggestionText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTitleForSuggestionKey(title: string) {
  const normalized = normalizeSuggestionText(normalizeTitleForDisplay(title));
  const withoutArticle = normalized.replace(/^(a|an|the)\s+/, "").trim();

  return withoutArticle || normalized;
}
