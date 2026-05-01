#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  normalizeSearchText,
  parseSongSuggestionCatalog,
} from "./import-song-suggestions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultSourcePath = path.join(
  repoRoot,
  "data/bhs_published_music_catalog.csv"
);
const defaultCatalogPath = path.join(
  repoRoot,
  "data/song_suggestion_catalog.psv"
);
const supportedVoicings = new Set(["TTBB", "SATB", "SSAA"]);

function cleanText(value) {
  const trimmed = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed || null;
}

function decodeBasicHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "...");
}

export function parseCsv(contents) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index];
    const nextChar = contents[index + 1];

    if (quoted) {
      if (char === '"' && nextChar === '"') {
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
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseBhsRows(contents) {
  const [header, ...rows] = parseCsv(contents).filter((row) =>
    row.some((field) => field.trim())
  );

  const expectedHeader = [
    "Product Code/SKU",
    "Product Name",
    "Product Description",
    "Arranger",
    "Difficulty",
    "Ensemble",
  ];

  if (!header || header.join("|") !== expectedHeader.join("|")) {
    throw new Error(`Expected BHS CSV header: ${expectedHeader.join(",")}`);
  }

  return rows.map((row, index) => ({
    rowNumber: index + 2,
    sku: row[0] ?? "",
    productName: row[1] ?? "",
    productDescription: row[2] ?? "",
    arranger: row[3] ?? "",
    difficulty: row[4] ?? "",
    ensemble: row[5] ?? "",
  }));
}

function hasNonFourPartSignal(row) {
  const productName = row.productName.toLowerCase();
  const firstDescriptionSegment = row.productDescription
    .split("|")[0]
    .toLowerCase();
  const combined = `${productName} ${firstDescriptionSegment}`;

  return [
    /\b8[- ]?part\b/,
    /\bdouble quartet\b/,
    /\bmixed double quartet\b/,
    /\bsatb\s*\+\s*soloists?\b/,
    /\bsoloists?\b/,
    /\bsongbook\b/,
    /\bdigital bundle\b/,
    /\bdownload bundle\b/,
    /\bsing in the barbershop quartet\b/,
  ].some((pattern) => pattern.test(combined));
}

function voicingsFromText(value) {
  return Array.from(
    new Set(
      Array.from(String(value ?? "").matchAll(/\b(TTBB|SATB|SSAA)\b/gi))
        .map((match) => match[1].toUpperCase())
        .filter((voicing) => supportedVoicings.has(voicing))
    )
  );
}

function descriptionVoicing(row) {
  const firstSegment = cleanText(row.productDescription.split("|")[0]) ?? "";
  const explicit = voicingsFromText(firstSegment);
  if (explicit.length > 0) return explicit;

  const lower = firstSegment.toLowerCase();
  if (/\bmixed voices?\b/.test(lower)) return ["SATB"];
  if (/\b(female|women'?s|high) voices?\b/.test(lower)) return ["SSAA"];
  if (/\b(male|men'?s|low) voices?\b/.test(lower)) return ["TTBB"];

  return [];
}

function inferVoicings(row) {
  if (hasNonFourPartSignal(row)) {
    return {
      voicings: [],
      reason: "non_four_part_or_collection",
    };
  }

  const productNameVoicings = voicingsFromText(row.productName);
  if (productNameVoicings.length > 0) {
    return { voicings: productNameVoicings, reason: null };
  }

  const descriptionVoicings = descriptionVoicing(row);
  if (descriptionVoicings.length > 0) {
    return { voicings: descriptionVoicings, reason: null };
  }

  const ensembleVoicings = voicingsFromText(row.ensemble);
  if (ensembleVoicings.length > 0) {
    return { voicings: ensembleVoicings, reason: null };
  }

  return { voicings: [], reason: "missing_or_ambiguous_voicing" };
}

function stripTrailingMetadata(title) {
  let current = cleanText(decodeBasicHtmlEntities(title)) ?? "";
  let previous = "";

  while (current && current !== previous) {
    previous = current;
    current = current
      .replace(/\s*-\s*arr\.?\s+.+$/i, "")
      .replace(/\s*-\s*(?:print|download|digital download)$/i, "")
      .replace(/\s*\((?:arr\.?|arranged by)[^)]*\)\s*$/i, "")
      .replace(/\s*\((?:TTBB|SATB|SSAA)(?:\s*[/,]\s*(?:TTBB|SATB|SSAA))*\)\s*$/i, "")
      .replace(/\s*\((?:formerly|form\.?)[^)]*\)\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return cleanText(current);
}

function extractTitle(row) {
  return stripTrailingMetadata(row.productName);
}

function arrangerFromDescription(description) {
  const firstSegment = description.split("|").find((segment) =>
    /\b(?:arranged by|arr\.?)\b/i.test(segment)
  );
  if (!firstSegment) return null;

  const match = firstSegment.match(/\b(?:arranged by|arr\.?)\s*:?\s*([^|(]+)/i);
  if (!match) return null;

  return cleanText(
    match[1]
      .replace(/\bformerly\b.*$/i, "")
      .replace(/\bavailable\b.*$/i, "")
      .replace(/\bas sung by\b.*$/i, "")
      .replace(/\s*,\s*$/, "")
  );
}

function arrangerFromProductName(productName) {
  const match = productName.match(/\((?:arr\.?|arranged by)\s*([^)]*)\)\s*$/i);
  return match ? cleanText(match[1]) : null;
}

function extractArranger(row) {
  return (
    cleanText(row.arranger) ??
    arrangerFromDescription(row.productDescription) ??
    arrangerFromProductName(row.productName)
  );
}

function catalogKey(row) {
  return [
    row.normalized_title,
    row.voicing,
    row.normalized_arranger ?? "",
  ].join("|");
}

function toCatalogRow({ title, voicing, arranger, source }) {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedArranger = arranger ? normalizeSearchText(arranger) : null;

  return {
    title,
    normalized_title: normalizedTitle,
    voicing,
    arranger,
    normalized_arranger: normalizedArranger,
    source,
  };
}

export function transformBhsPublishedMusicCatalog(contents) {
  const deduped = new Map();
  const skipped = [];
  const bhsRows = parseBhsRows(contents);
  let duplicateCount = 0;

  for (const row of bhsRows) {
    const title = extractTitle(row);
    if (!title) {
      skipped.push({
        rowNumber: row.rowNumber,
        sku: row.sku,
        productName: row.productName,
        reason: "missing_title",
      });
      continue;
    }

    const { voicings, reason } = inferVoicings(row);
    if (voicings.length === 0) {
      skipped.push({
        rowNumber: row.rowNumber,
        sku: row.sku,
        productName: row.productName,
        reason,
      });
      continue;
    }

    const arranger = extractArranger(row);

    for (const voicing of voicings) {
      const catalogRow = toCatalogRow({
        title,
        voicing,
        arranger,
        source: "BHS Published Music",
      });
      const key = catalogKey(catalogRow);

      if (deduped.has(key)) {
        duplicateCount += 1;
        continue;
      }

      deduped.set(key, catalogRow);
    }
  }

  const rows = sortCatalogRows(Array.from(deduped.values()));
  const reasonCounts = skipped.reduce((counts, skip) => {
    counts[skip.reason] = (counts[skip.reason] ?? 0) + 1;
    return counts;
  }, {});

  return {
    rows,
    report: {
      sourceRows: bhsRows.length,
      importedRows: rows.length,
      skippedRows: skipped.length,
      duplicateRows: duplicateCount,
      reasonCounts,
      skipped,
    },
  };
}

function sortCatalogRows(rows) {
  return [...rows].sort((a, b) => {
    return (
      a.title.localeCompare(b.title) ||
      a.voicing.localeCompare(b.voicing) ||
      (a.arranger ?? "").localeCompare(b.arranger ?? "")
    );
  });
}

export function mergeCatalogRows(existingRows, importedRows) {
  const deduped = new Map();
  let duplicateCount = 0;

  for (const row of [...existingRows, ...importedRows]) {
    const key = catalogKey(row);
    if (deduped.has(key)) {
      duplicateCount += 1;
      continue;
    }

    deduped.set(key, row);
  }

  return {
    rows: sortCatalogRows(Array.from(deduped.values())),
    duplicateCount,
  };
}

function psvCell(value) {
  return String(value ?? "").replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();
}

export function formatSongSuggestionCatalog(rows) {
  const lines = ["Song Title|Voicing|Arranger"];

  for (const row of rows) {
    lines.push(
      [psvCell(row.title), psvCell(row.voicing), psvCell(row.arranger)].join("|")
    );
  }

  return `${lines.join("\n")}\n`;
}

function printReport(report, { mergedRows, existingDuplicateRows } = {}) {
  console.log(`BHS source rows: ${report.sourceRows}`);
  console.log(`BHS imported suggestion rows: ${report.importedRows}`);
  console.log(`BHS duplicate product rows collapsed: ${report.duplicateRows}`);
  console.log(`BHS skipped rows: ${report.skippedRows}`);

  for (const [reason, count] of Object.entries(report.reasonCounts).sort()) {
    console.log(`  ${reason}: ${count}`);
  }

  if (typeof existingDuplicateRows === "number") {
    console.log(
      `Duplicates already covered by existing catalog: ${existingDuplicateRows}`
    );
  }

  if (typeof mergedRows === "number") {
    console.log(`Merged catalog rows: ${mergedRows}`);
  }
}

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const sourcePath = path.resolve(optionValue("source") ?? defaultSourcePath);
  const catalogPath = path.resolve(optionValue("catalog") ?? defaultCatalogPath);
  const outputPath = path.resolve(optionValue("output") ?? catalogPath);
  const writeCatalog = args.has("--write-catalog");
  const printSkipped = args.has("--print-skipped");

  const sourceContents = await readFile(sourcePath, "utf8");
  const { rows: bhsRows, report } =
    transformBhsPublishedMusicCatalog(sourceContents);

  if (!writeCatalog) {
    printReport(report);
    if (printSkipped) {
      console.log(JSON.stringify(report.skipped.slice(0, 100), null, 2));
    }
    return;
  }

  const existingContents = await readFile(catalogPath, "utf8");
  const existingRows = parseSongSuggestionCatalog(existingContents);
  const merged = mergeCatalogRows(existingRows, bhsRows);

  await writeFile(outputPath, formatSongSuggestionCatalog(merged.rows), "utf8");
  printReport(report, {
    mergedRows: merged.rows.length,
    existingDuplicateRows: merged.duplicateCount,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
