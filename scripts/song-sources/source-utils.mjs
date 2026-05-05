export const supportedSourceVoicings = new Set(["TTBB", "SATB", "SSAA"]);

export function cleanSourceText(value) {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export function normalizeTitleArticle(value) {
  const title = cleanSourceText(value);
  if (!title) return null;

  const articleMatch = title.match(/^(.*),\s*(The|A|An)$/i);
  if (!articleMatch) return title;

  return cleanSourceText(`${articleMatch[2]} ${articleMatch[1]}`);
}

export function normalizeTitleForDisplay(value) {
  return normalizeTitleArticle(value);
}

export function normalizeSuggestionText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTitleForSuggestionKey(value) {
  const normalized = normalizeSuggestionText(normalizeTitleForDisplay(value) ?? "");
  const withoutArticle = normalized.replace(/^(a|an|the)\s+/, "").trim();

  return withoutArticle || normalized;
}

export function normalizeArrangerName(value, { flipCommaName = false } = {}) {
  const arranger = cleanSourceText(value);
  if (!arranger) return null;

  let normalized = arranger
    .replace(/\s*;\s*/g, ", ")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();

  if (flipCommaName) {
    const commaName = normalized.match(/^([^,]+),\s*([^,]+)$/);
    if (commaName) normalized = `${commaName[2]} ${commaName[1]}`;
  }

  return cleanSourceText(normalized);
}

function normalizedVoicingToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeSourceVoicings(value, { noneSpecifiedAsTTBB = false } = {}) {
  const raw = cleanSourceText(value);
  if (!raw) return [];

  const tokens = raw
    .split(/[,/|]+|\band\b/i)
    .map((token) => token.trim())
    .filter(Boolean);
  const voicings = new Set();

  for (const token of tokens.length > 0 ? tokens : [raw]) {
    const upper = token.toUpperCase();
    const normalized = normalizedVoicingToken(token);

    if (supportedSourceVoicings.has(upper)) {
      voicings.add(upper);
    } else if (
      normalized === "mens track" ||
      normalized === "men track" ||
      normalized === "lower voices" ||
      normalized === "lower voice" ||
      normalized === "male voices" ||
      normalized === "mens voices" ||
      normalized === "men voices" ||
      normalized === "mens" ||
      normalized === "men" ||
      normalized === "male" ||
      normalized === "m"
    ) {
      voicings.add("TTBB");
    } else if (
      normalized === "womens track" ||
      normalized === "women track" ||
      normalized === "ladies track" ||
      normalized === "lady track" ||
      normalized === "upper voices" ||
      normalized === "upper voice" ||
      normalized === "female voices" ||
      normalized === "womens voices" ||
      normalized === "women voices" ||
      normalized === "womens" ||
      normalized === "women" ||
      normalized === "ladies" ||
      normalized === "female" ||
      normalized === "young ssaa" ||
      normalized === "f"
    ) {
      voicings.add("SSAA");
    } else if (
      normalized === "mixed track" ||
      normalized === "mixed voices" ||
      normalized === "mixed voice" ||
      normalized === "mixed" ||
      normalized === "x"
    ) {
      voicings.add("SATB");
    } else if (noneSpecifiedAsTTBB && normalized === "none specified") {
      voicings.add("TTBB");
    }
  }

  return Array.from(voicings);
}

export function sourceRowKey(row) {
  return [
    normalizeTitleForSuggestionKey(row.title),
    row.voicing,
    normalizeSuggestionText(row.arranger ?? ""),
  ].join("|");
}

function preferredSourceTitle(current, next) {
  if (next.length > current.length) return next;
  if (next.length < current.length) return current;
  return current.localeCompare(next) <= 0 ? current : next;
}

export function sortSourceRows(rows) {
  return [...rows].sort((a, b) => {
    return (
      String(a.title ?? "").localeCompare(String(b.title ?? "")) ||
      String(a.voicing ?? "").localeCompare(String(b.voicing ?? "")) ||
      String(a.arranger ?? "").localeCompare(String(b.arranger ?? ""))
    );
  });
}

export function dedupeSourceRows(rows) {
  const deduped = new Map();
  let duplicateRows = 0;

  for (const row of rows) {
    const title = cleanSourceText(row.title);
    const voicing = cleanSourceText(row.voicing)?.toUpperCase();
    if (!title || !voicing || !supportedSourceVoicings.has(voicing)) continue;

    const normalizedRow = {
      title,
      voicing,
      arranger: cleanSourceText(row.arranger),
      source: row.source,
    };
    const key = sourceRowKey(normalizedRow);

    if (deduped.has(key)) {
      duplicateRows += 1;
      const existing = deduped.get(key);
      existing.title = preferredSourceTitle(existing.title, normalizedRow.title);
      continue;
    }

    deduped.set(key, normalizedRow);
  }

  return {
    rows: sortSourceRows(Array.from(deduped.values())),
    duplicateRows,
  };
}
