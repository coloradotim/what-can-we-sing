import { cleanSourceText, dedupeSourceRows, normalizeSourceVoicings } from "./source-utils.mjs";

export const sourcePsvHeader = "Song Title|Voicing|Arranger";

export function psvCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "/")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSourcePsv(rows) {
  const deduped = dedupeSourceRows(rows);
  const lines = [sourcePsvHeader];

  for (const row of deduped.rows) {
    lines.push(
      [psvCell(row.title), psvCell(row.voicing), psvCell(row.arranger)].join("|")
    );
  }

  return `${lines.join("\n")}\n`;
}

export function parseSourcePsv(contents) {
  const lines = String(contents ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const [header, ...rows] = lines;

  if (header !== sourcePsvHeader) {
    throw new Error(`Expected PSV header: ${sourcePsvHeader}`);
  }

  const parsedRows = [];

  for (const [index, row] of rows.entries()) {
    const columns = row.split("|");
    if (columns.length !== 3) {
      throw new Error(`Invalid PSV row ${index + 2}: expected 3 columns.`);
    }

    const [titleValue, voicingValue, arrangerValue] = columns;
    const title = cleanSourceText(titleValue);
    const voicings = normalizeSourceVoicings(voicingValue);
    const arranger = cleanSourceText(arrangerValue);

    if (!title || voicings.length === 0) continue;

    for (const voicing of voicings) {
      parsedRows.push({ title, voicing, arranger });
    }
  }

  return dedupeSourceRows(parsedRows).rows;
}

