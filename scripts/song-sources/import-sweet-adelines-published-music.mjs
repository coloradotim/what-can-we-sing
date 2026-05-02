#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import { formatSourcePsv } from "./psv.mjs";
import {
  cleanSourceText,
  dedupeSourceRows,
  normalizeArrangerName,
  normalizeTitleArticle,
} from "./source-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultPdfUrl =
  "https://sweetadelines.com/sites/default/files/Resources/Find-and-purchase-music/Published%20Music%2012.2.2024.pdf";
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/sweet_adelines_published_music_song_suggestions.psv"
);
const skippedRowsPath = path.join(
  repoRoot,
  "tmp/song-sources/sweet-adelines-published-music-skipped.json"
);
const debugTextPath = path.join(
  repoRoot,
  "tmp/song-sources/sweet-adelines-published-music-debug.txt"
);

const sourceVoicing = "SSAA";
const rowIdPattern = /^[A-Z]{2}\d+\s/;
const difficultyPattern = "(?:E/M|M/D|E|M|D)";
const typeLabels = [
  "Swing Ballad",
  "Swing Uptune",
  "Public Domain",
  "Easy/Medium",
  "Challenging",
  "Religious",
  "Patriotic",
  "Holiday",
  "Difficult",
  "Uptune",
  "Ballad",
  "Medium",
  "Domain",
  "Easy",
  "Avis US",
  "SA",
];

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function shouldSkipExtractedLine(line) {
  return (
    /^\d+$/.test(line) ||
    /^ID#\s+SONG TITLE/i.test(line) ||
    /^LEVEL ARRANGER$/i.test(line) ||
    /^SWEET ADELINES INTERNATIONAL PUBLISHED MUSIC$/i.test(line) ||
    /^U=Uptune\b/i.test(line) ||
    /^from Competition$/i.test(line) ||
    /^Last Update:/i.test(line) ||
    /^-- \d+ of \d+ --$/.test(line)
  );
}

function extractedRecords(text) {
  const records = [];
  let currentRecord = null;
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (shouldSkipExtractedLine(line)) continue;

    if (rowIdPattern.test(line)) {
      if (currentRecord) records.push(currentRecord);
      currentRecord = line;
    } else if (currentRecord) {
      currentRecord = `${currentRecord} ${line}`;
    }
  }

  if (currentRecord) records.push(currentRecord);
  return records;
}

function typePattern() {
  return typeLabels
    .map((label) => label.replace(/\s+/g, "\\s+"))
    .join("|");
}

function splitTitleAndArranger(body) {
  const normalizedBody = cleanSourceText(body);
  if (!normalizedBody) return null;

  const typeRegex = new RegExp(
    `^(.+?)\\s+(${typePattern()})(?:\\s+(${difficultyPattern}))?\\s+(.+)$`
  );
  const typeMatch = normalizedBody.match(typeRegex);
  if (typeMatch) {
    return {
      title: typeMatch[1],
      arranger: typeMatch[4],
    };
  }

  const difficultyRegex = new RegExp(
    `^(.+?)\\s+(${difficultyPattern})\\s+(.+)$`
  );
  const difficultyMatch = normalizedBody.match(difficultyRegex);
  if (difficultyMatch) {
    return {
      title: difficultyMatch[1],
      arranger: difficultyMatch[3],
    };
  }

  const tokens = normalizedBody.split(/\s+/);
  const arrangerStartIndex = tokens.findIndex(
    (token) => /[a-z]/.test(token) || token === "Unknown"
  );

  if (arrangerStartIndex <= 0) return null;

  return {
    title: tokens.slice(0, arrangerStartIndex).join(" "),
    arranger: tokens.slice(arrangerStartIndex).join(" "),
  };
}

export function normalizeSweetAdelinesTitle(value) {
  const cleaned = cleanSourceText(value)
    ?.replace(/^YW\s*-\s*/i, "")
    .replace(/\s+\(SSAA\)\s*/gi, " ")
    .replace(/\s*-\s*FREE DOWNLOAD\s*$/i, "")
    .replace(/\s+FREE DOWNLOAD\s*$/i, "")
    .replace(/\*{1,2}/g, "");

  return normalizeTitleArticle(cleaned);
}

export function parseSweetAdelinesPublishedMusicText(text) {
  const rows = [];
  const skipped = [];

  for (const record of extractedRecords(text)) {
    const idMatch = record.match(/^([A-Z]{2}\d+)\s+(.+)$/);
    if (!idMatch) {
      skipped.push({ record, reason: "missing_source_id" });
      continue;
    }

    const sourceId = idMatch[1];
    const split = splitTitleAndArranger(idMatch[2]);

    if (!split) {
      skipped.push({ sourceId, record, reason: "could_not_split_title_arranger" });
      continue;
    }

    const title = normalizeSweetAdelinesTitle(split.title);
    const arranger = normalizeArrangerName(split.arranger);

    if (!title) {
      skipped.push({ sourceId, record, reason: "missing_title" });
      continue;
    }

    if (!arranger) {
      skipped.push({ sourceId, title, record, reason: "missing_arranger" });
      continue;
    }

    rows.push({
      title,
      voicing: sourceVoicing,
      arranger,
      source: "Sweet Adelines published music list",
    });
  }

  const deduped = dedupeSourceRows(rows);
  return {
    rows: deduped.rows,
    report: {
      sourceRows: extractedRecords(text).length,
      importedRows: deduped.rows.length,
      duplicateRows: deduped.duplicateRows,
      skippedRows: skipped.length,
      skipped,
    },
  };
}

async function extractPdfText(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function pdfBufferFromSource(pdfPath) {
  if (pdfPath) return readFile(path.resolve(pdfPath));

  const response = await fetch(defaultPdfUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download Sweet Adelines PDF: ${response.status} ${response.statusText}`
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const pdfPath = optionValue("pdf-path");
  const outputPath = path.resolve(optionValue("output") ?? defaultOutputPath);
  const writeDebug = args.has("--debug-text");
  const pdfBuffer = await pdfBufferFromSource(pdfPath);
  const text = await extractPdfText(pdfBuffer);
  const { rows, report } = parseSweetAdelinesPublishedMusicText(text);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  await mkdir(path.dirname(skippedRowsPath), { recursive: true });
  await writeFile(skippedRowsPath, `${JSON.stringify(report.skipped, null, 2)}\n`, "utf8");

  if (writeDebug) {
    await mkdir(path.dirname(debugTextPath), { recursive: true });
    await writeFile(debugTextPath, text, "utf8");
  }

  console.log(`Sweet Adelines source rows: ${report.sourceRows}`);
  console.log(`Sweet Adelines imported suggestion rows: ${report.importedRows}`);
  console.log(`Sweet Adelines duplicate rows collapsed: ${report.duplicateRows}`);
  console.log(`Sweet Adelines skipped rows: ${report.skippedRows}`);
  console.log(`Sweet Adelines voicing: ${sourceVoicing}`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}.`);
  console.log(`Wrote ${path.relative(repoRoot, skippedRowsPath)}.`);
  if (writeDebug) console.log(`Wrote ${path.relative(repoRoot, debugTextPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
