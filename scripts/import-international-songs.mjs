#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  formatSongSuggestionCatalog,
  mergeCatalogRows,
  parseCsv,
} from "./import-bhs-published-music.mjs";
import {
  normalizeSearchText,
  parseSongSuggestionCatalog,
} from "./import-song-suggestions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultSourcePath = path.join(
  repoRoot,
  "data/international_songs_with_arranger.csv"
);
const defaultCatalogPath = path.join(
  repoRoot,
  "data/song_suggestion_catalog.psv"
);
const supportedVoicings = new Set(["TTBB", "SATB", "SSAA"]);
const sourceName = "International Songs with Arranger";

function cleanText(value) {
  const trimmed = String(value ?? "").replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function catalogKey(row) {
  return [
    row.normalized_title,
    row.voicing,
    row.normalized_arranger ?? "",
  ].join("|");
}

function toCatalogRow({ title, voicing, arranger }) {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedArranger = arranger ? normalizeSearchText(arranger) : null;

  return {
    title,
    normalized_title: normalizedTitle,
    voicing,
    arranger,
    normalized_arranger: normalizedArranger,
    source: sourceName,
  };
}

function splitVoicingTokens(value) {
  return String(value ?? "")
    .split(/[,+/&;]/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

function mapVoicings(value) {
  const tokens = splitVoicingTokens(value);
  if (tokens.length === 0) {
    return { voicings: [], reason: "missing_or_ambiguous_voicing" };
  }

  const voicings = Array.from(
    new Set(tokens.filter((token) => supportedVoicings.has(token)))
  );

  if (voicings.length !== tokens.length || voicings.length === 0) {
    return { voicings: [], reason: "unsupported_or_ambiguous_voicing" };
  }

  return { voicings, reason: null };
}

function parseInternationalRows(contents) {
  const [header, ...rows] = parseCsv(contents).filter((row) =>
    row.some((field) => field.trim())
  );
  const expectedHeader = ["Title", "Arranger", "Voicing"];

  if (!header || header.join("|") !== expectedHeader.join("|")) {
    throw new Error(`Expected International CSV header: ${expectedHeader.join(",")}`);
  }

  return rows.map((row, index) => ({
    rowNumber: index + 2,
    title: row[0] ?? "",
    arranger: row[1] ?? "",
    voicing: row[2] ?? "",
  }));
}

export function transformInternationalSongsCatalog(contents) {
  const sourceRows = parseInternationalRows(contents);
  const deduped = new Map();
  const skipped = [];
  let duplicateCount = 0;

  for (const row of sourceRows) {
    const title = cleanText(row.title);
    if (!title) {
      skipped.push({
        rowNumber: row.rowNumber,
        reason: "missing_title",
      });
      continue;
    }

    const { voicings, reason } = mapVoicings(row.voicing);
    if (voicings.length === 0) {
      skipped.push({
        rowNumber: row.rowNumber,
        title,
        voicing: row.voicing,
        reason,
      });
      continue;
    }

    const arranger = cleanText(row.arranger);

    for (const voicing of voicings) {
      const catalogRow = toCatalogRow({ title, voicing, arranger });
      const key = catalogKey(catalogRow);

      if (deduped.has(key)) {
        duplicateCount += 1;
        continue;
      }

      deduped.set(key, catalogRow);
    }
  }

  const rows = Array.from(deduped.values()).sort((a, b) => {
    return (
      a.title.localeCompare(b.title) ||
      a.voicing.localeCompare(b.voicing) ||
      (a.arranger ?? "").localeCompare(b.arranger ?? "")
    );
  });
  const reasonCounts = skipped.reduce((counts, skip) => {
    counts[skip.reason] = (counts[skip.reason] ?? 0) + 1;
    return counts;
  }, {});

  return {
    rows,
    report: {
      sourceRows: sourceRows.length,
      importedRows: rows.length,
      skippedRows: skipped.length,
      duplicateRows: duplicateCount,
      reasonCounts,
      skipped,
    },
  };
}

function printReport(report, { mergedRows, existingDuplicateRows } = {}) {
  console.log(`International source rows: ${report.sourceRows}`);
  console.log(`International imported suggestion rows: ${report.importedRows}`);
  console.log(`International duplicate source rows collapsed: ${report.duplicateRows}`);
  console.log(`International skipped rows: ${report.skippedRows}`);

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
  const { rows: importedRows, report } =
    transformInternationalSongsCatalog(sourceContents);

  if (!writeCatalog) {
    printReport(report);
    if (printSkipped) {
      console.log(JSON.stringify(report.skipped.slice(0, 100), null, 2));
    }
    return;
  }

  const existingContents = await readFile(catalogPath, "utf8");
  const existingRows = parseSongSuggestionCatalog(existingContents);
  const merged = mergeCatalogRows(existingRows, importedRows);

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
