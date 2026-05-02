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
} from "./source-utils.mjs";
import { normalizeSweetAdelinesTitle } from "./import-sweet-adelines-published-music.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultPdfUrl =
  "https://sweetadelines.com/sites/default/files/Resources/Find-and-purchase-music/Arranged%20Music%20List%208-8-2024.pdf";
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/sweet_adelines_arranged_music_song_suggestions.psv"
);
const skippedRowsPath = path.join(
  repoRoot,
  "tmp/song-sources/sweet-adelines-arranged-music-skipped.json"
);
const debugTextPath = path.join(
  repoRoot,
  "tmp/song-sources/sweet-adelines-arranged-music-debug.txt"
);

const sourceVoicing = "SSAA";
const rowIdPattern = /^I\d+\s/;
const knownMultiTokenArrangerNames = [
  "Anna Maria Parker",
  "Anna Marie Parker",
  "Becky L Wilkins",
  "Carolyn E Johnson",
  "Donna M Shorkey",
  "Flora Beth Cunningham",
  "Joanne E Dockrell",
  "Jim Arns",
  "La Veda Redfield",
  "Lynne Alice Peterson",
  "Marie B Johnson",
  "Mary Ann Wydra",
  "Mary Grace Lodico",
  "Mary K Coffman",
  "Mary K Coffman Music Fund",
  "Mary Lou Gomez-Leon",
  "Mike Senter Music",
  "Patsee Yvonne Parker",
  "Randy Fink Sahae",
  "Susan Kegley Lamb",
].map((name) => name.split(/\s+/));

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function shouldSkipExtractedLine(line) {
  return (
    /^\d+$/.test(line) ||
    /^-- \d+ of \d+ --$/.test(line) ||
    /^Sweet Adelines International Arranged Music List/i.test(line) ||
    /^Id Number\s+Title of Arrangement\s+Arranger$/i.test(line)
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

function looksLikeInitial(token) {
  return /^[A-Za-z]\.?$/.test(token);
}

function looksLikeNameToken(token) {
  return /^('?\p{Lu}[\p{L}'.:-]*;?|\('?\p{Lu}[\p{L}'.:-]*\)|Unknown)$/u.test(
    token
  );
}

function looksLikeNameParticle(token) {
  return /^(de|da|di|del|van|von|k)$/i.test(token);
}

function looksLikeHonorific(token) {
  return /^(Dr|Mr|Mrs|Ms)\.?$/i.test(token);
}

function validArrangerTokens(tokens) {
  return tokens.every(
    (token) =>
      token === "and" ||
      looksLikeNameToken(token) ||
      looksLikeNameParticle(token) ||
      looksLikeInitial(token) ||
      looksLikeHonorific(token)
  );
}

function arrangerTokenCount(tokens) {
  if (tokens.length < 3) return 0;

  let count = 2;
  const thirdFromEnd = tokens[tokens.length - 3];
  const fourthFromEnd = tokens[tokens.length - 4];
  const fifthFromEnd = tokens[tokens.length - 5];
  const sixthFromEnd = tokens[tokens.length - 6];
  const matchingKnownName = knownMultiTokenArrangerNames
    .filter(
      (nameTokens) =>
        tokens.length > nameTokens.length &&
        nameTokens.every((token, index) => {
          const sourceToken =
            tokens[tokens.length - nameTokens.length + index]?.replace(/\.$/, "");
          return sourceToken?.toLowerCase() === token.toLowerCase();
        })
    )
    .sort((a, b) => b.length - a.length)[0];

  if (matchingKnownName) {
    count = matchingKnownName.length;
  } else if (
    (tokens[tokens.length - 2]?.endsWith(";") || thirdFromEnd?.endsWith(";")) &&
    validArrangerTokens(tokens.slice(-4))
  ) {
    count = 4;
  } else if (looksLikeHonorific(thirdFromEnd)) {
    count = 3;
  } else if (tokens.length > 4 && looksLikeHonorific(fourthFromEnd)) {
    count = 4;
  } else if (looksLikeInitial(tokens[tokens.length - 2])) {
    count = 3;
  } else if (looksLikeNameParticle(tokens[tokens.length - 2])) {
    count = 3;
  } else if (looksLikeNameParticle(thirdFromEnd)) {
    count = 4;
  } else if (
    [
      "Anna Maria",
      "Becky L",
      "Carolyn E",
      "Donna M",
      "Joanne E",
      "Marie B",
      "Mary K",
      "Patsee Yvonne",
    ].includes(
      `${thirdFromEnd} ${tokens[tokens.length - 2]?.replace(/\.$/, "")}`
    )
  ) {
    count = 3;
  } else if (
    tokens[tokens.length - 3] === "and" &&
    looksLikeNameToken(fifthFromEnd) &&
    looksLikeNameToken(fourthFromEnd)
  ) {
    count = 5;
  } else if (
    tokens[tokens.length - 4] === "and" &&
    looksLikeNameToken(sixthFromEnd) &&
    looksLikeNameToken(fifthFromEnd)
  ) {
    count = 6;
  } else if (thirdFromEnd === "Susan" && tokens[tokens.length - 2] === "Kegley") {
    count = 3;
  }

  const arrangerTokens = tokens.slice(-count);
  if (!validArrangerTokens(arrangerTokens)) {
    return 0;
  }

  return count;
}

function splitTitleAndArranger(body) {
  const normalizedBody = cleanSourceText(body)?.replace(
    /Jim\s+ArnsShort\s+Version$/,
    "Jim Arns"
  );
  if (!normalizedBody) return null;

  const tokens = normalizedBody.split(/\s+/);
  const count = arrangerTokenCount(tokens);
  if (count === 0 || tokens.length <= count) return null;

  return {
    title: tokens.slice(0, -count).join(" "),
    arranger: tokens.slice(-count).join(" "),
  };
}

function normalizeArrangedMusicTitle(value) {
  const title = normalizeSweetAdelinesTitle(value)
    ?.replace(/^\d{3,5}\s+/, "")
    .replace(/\*+/g, "");
  return cleanSourceText(title);
}

function normalizeArrangedMusicArranger(value) {
  return normalizeArrangerName(
    cleanSourceText(value)
      ?.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, "")
      .replace(/:+$/g, "")
      .replace(/[()]/g, " ")
  );
}

export function parseSweetAdelinesArrangedMusicText(text) {
  const rows = [];
  const skipped = [];
  const records = extractedRecords(text);

  for (const record of records) {
    const idMatch = record.match(/^(I\d+)\s+(.+)$/);
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

    const title = normalizeArrangedMusicTitle(split.title);
    const arranger = normalizeArrangedMusicArranger(split.arranger);

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
      source: "Sweet Adelines arranged music list",
    });
  }

  const deduped = dedupeSourceRows(rows);
  return {
    rows: deduped.rows,
    report: {
      sourceRows: records.length,
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
      `Failed to download Sweet Adelines arranged music PDF: ${response.status} ${response.statusText}`
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
  const { rows, report } = parseSweetAdelinesArrangedMusicText(text);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  await mkdir(path.dirname(skippedRowsPath), { recursive: true });
  await writeFile(skippedRowsPath, `${JSON.stringify(report.skipped, null, 2)}\n`, "utf8");

  if (writeDebug) {
    await mkdir(path.dirname(debugTextPath), { recursive: true });
    await writeFile(debugTextPath, text, "utf8");
  }

  console.log(`Sweet Adelines arranged music source rows: ${report.sourceRows}`);
  console.log(
    `Sweet Adelines arranged music imported suggestion rows: ${report.importedRows}`
  );
  console.log(
    `Sweet Adelines arranged music duplicate rows collapsed: ${report.duplicateRows}`
  );
  console.log(`Sweet Adelines arranged music skipped rows: ${report.skippedRows}`);
  console.log(`Sweet Adelines arranged music voicing: ${sourceVoicing}`);
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
