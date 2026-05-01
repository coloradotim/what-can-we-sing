export function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function cleanText(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text.toUpperCase() === "NULL") return null;
  return text;
}

export function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows, columns) {
  const header = columns.join(",");
  const body = rows.map((row) =>
    columns.map((column) => csvEscape(row[column])).join(",")
  );
  return `${[header, ...body].join("\n")}\n`;
}

export function parseCsv(contents) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index];
    const next = contents[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);

  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  return dataRows.map((dataRow, rowIndex) => {
    if (dataRow.length !== header.length) {
      throw new Error(
        `Invalid CSV row ${rowIndex + 2}: expected ${header.length} columns, got ${dataRow.length}.`
      );
    }

    return Object.fromEntries(
      header.map((column, columnIndex) => [column, dataRow[columnIndex] ?? ""])
    );
  });
}
