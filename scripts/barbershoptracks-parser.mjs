const supportedVoicings = new Set(["TTBB", "SATB", "SSAA"]);

function cleanText(value) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export function normalizeBarbershopTracksTitle(value) {
  const title = cleanText(value);
  if (!title) return null;

  const articleMatch = title.match(/^(.*),\s*(The|A|An)$/i);
  if (!articleMatch) return title;

  const baseTitle = articleMatch[1].trim();
  const article = articleMatch[2];
  return cleanText(`${article} ${baseTitle}`);
}

export function normalizeBarbershopTracksArranger(value) {
  const arranger = cleanText(value);
  if (!arranger) return null;

  return cleanText(
    arranger
      .replace(/\s*;\s*/g, ", ")
      .replace(/\s*&\s*/g, " and ")
  );
}

export function normalizeBarbershopTracksVoicing(value) {
  const voicing = cleanText(value);
  if (!voicing) return null;

  const normalized = voicing
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();

  if (normalized === "mens track" || normalized === "men track") return "TTBB";
  if (
    normalized === "womens track" ||
    normalized === "women track" ||
    normalized === "ladies track" ||
    normalized === "lady track"
  ) {
    return "SSAA";
  }
  if (normalized === "mixed track") return "SATB";

  if (supportedVoicings.has(voicing.toUpperCase())) return voicing.toUpperCase();

  return null;
}

function fieldValue(line, fieldName) {
  const match = line.match(new RegExp(`^${fieldName}:\\s*(.*)$`, "i"));
  return match ? match[1] : null;
}

function isRecordBoundary(line) {
  return (
    /^learn more$/i.test(line) ||
    /^arranger:/i.test(line) ||
    /^voicing:/i.test(line) ||
    /^contestable:/i.test(line) ||
    /^genre:/i.test(line) ||
    /^artist:/i.test(line) ||
    /^artist website:/i.test(line)
  );
}

function renderedLines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseBarbershopTracksRenderedText(text) {
  const lines = renderedLines(text);
  const rows = [];
  const skipped = [];

  for (let index = 0; index < lines.length; index += 1) {
    const arrangerValue = fieldValue(lines[index], "Arranger");
    if (arrangerValue === null) continue;

    const titleLine = lines[index - 1];
    const title = titleLine && !isRecordBoundary(titleLine)
      ? normalizeBarbershopTracksTitle(titleLine)
      : null;
    const arranger = normalizeBarbershopTracksArranger(arrangerValue);
    let rawVoicing = null;

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      if (/^arranger:/i.test(lines[nextIndex])) break;
      const voicingValue = fieldValue(lines[nextIndex], "Voicing");
      if (voicingValue !== null) {
        rawVoicing = voicingValue;
        break;
      }
      if (/^learn more$/i.test(lines[nextIndex])) break;
    }

    const voicing = normalizeBarbershopTracksVoicing(rawVoicing);

    if (!title) {
      skipped.push({
        lineNumber: index + 1,
        arranger: arranger ?? arrangerValue,
        voicing: rawVoicing,
        reason: "missing_title",
      });
      continue;
    }

    if (!voicing) {
      skipped.push({
        lineNumber: index + 1,
        title,
        arranger,
        voicing: rawVoicing,
        reason: "unknown_voicing",
      });
      continue;
    }

    rows.push({
      title,
      voicing,
      arranger,
      source: "BarbershopTracks",
    });
  }

  return { rows, skipped };
}

function sourceKey(row) {
  return [
    row.title.trim().toLowerCase(),
    row.voicing,
    String(row.arranger ?? "").trim().toLowerCase(),
  ].join("|");
}

export function dedupeBarbershopTracksRows(rows) {
  const deduped = new Map();
  let duplicateRows = 0;

  for (const row of rows) {
    const key = sourceKey(row);
    if (deduped.has(key)) {
      duplicateRows += 1;
      continue;
    }
    deduped.set(key, row);
  }

  return {
    rows: sortBarbershopTracksRows(Array.from(deduped.values())),
    duplicateRows,
  };
}

export function sortBarbershopTracksRows(rows) {
  return [...rows].sort((a, b) => {
    return (
      a.title.localeCompare(b.title) ||
      a.voicing.localeCompare(b.voicing) ||
      String(a.arranger ?? "").localeCompare(String(b.arranger ?? ""))
    );
  });
}

export function psvCell(value) {
  return String(value ?? "").replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();
}

export function formatBarbershopTracksPsv(rows) {
  const lines = ["Song Title|Voicing|Arranger"];

  for (const row of sortBarbershopTracksRows(rows)) {
    lines.push(
      [psvCell(row.title), psvCell(row.voicing), psvCell(row.arranger)].join("|")
    );
  }

  return `${lines.join("\n")}\n`;
}

export function pageCountFromRenderedText(text, { fallbackPages = 159 } = {}) {
  const match = String(text ?? "").match(
    /Items\s+([\d,]+)\s+to\s+([\d,]+)\s+of\s+([\d,]+)\s+total/i
  );
  if (!match) return fallbackPages;

  const first = Number(match[1].replace(/,/g, ""));
  const last = Number(match[2].replace(/,/g, ""));
  const total = Number(match[3].replace(/,/g, ""));
  const pageSize = last - first + 1;

  if (!Number.isFinite(pageSize) || pageSize <= 0 || !Number.isFinite(total)) {
    return fallbackPages;
  }

  return Math.ceil(total / pageSize);
}
