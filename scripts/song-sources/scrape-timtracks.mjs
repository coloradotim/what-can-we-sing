#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { formatSourcePsv } from "./psv.mjs";
import {
  cleanSourceText,
  dedupeSourceRows,
  normalizeArrangerName,
  normalizeTitleArticle,
} from "./source-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/timtracks_song_suggestions.psv"
);
const skippedRowsPath = path.join(repoRoot, "tmp/song-sources/timtracks-skipped.json");
const endpoint = "https://timtracks.com/ajax.php";

const sourcePages = [
  {
    type: "mensTracks",
    url: "https://timtracks.com/tracks.php?type=mensTracks",
    pageVoicing: "TTBB",
  },
  {
    type: "womensTracks",
    url: "https://timtracks.com/tracks.php?type=womensTracks",
    pageVoicing: "SSAA",
  },
  {
    type: "mixedTracks",
    url: "https://timtracks.com/tracks.php?type=mixedTracks",
    pageVoicing: "SATB",
  },
  {
    type: "holidayTracks",
    url: "https://timtracks.com/tracks.php?type=holidayTracks",
    pageVoicing: null,
  },
];

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "...");
}

export function textFromHtml(value) {
  return cleanSourceText(
    decodeHtmlEntities(String(value ?? "").replace(/<[^>]*>/g, " "))
  );
}

export function normalizeTimTracksArranger(value) {
  const arranger = textFromHtml(value);
  if (!arranger) return null;
  const shouldFlipCommaName = /^[^,;&]+,\s*[^,;&]+$/.test(arranger);
  return normalizeArrangerName(arranger, { flipCommaName: shouldFlipCommaName });
}

function partCount(value) {
  const count = Number(cleanSourceText(value));
  return Number.isInteger(count) && count >= 0 ? count : null;
}

export function holidayVoicingForTimTracksRow(row) {
  const maleParts = partCount(row.numMaleParts);
  const femaleParts = partCount(row.numFemaleParts);

  if (maleParts === 4 && femaleParts === 0) return "TTBB";
  if (maleParts === 0 && femaleParts === 4) return "SSAA";
  if (maleParts === 2 && femaleParts === 2) return "SATB";

  return null;
}

export function transformTimTracksRow(row, source) {
  const title = normalizeTitleArticle(textFromHtml(row.title));
  const arranger = normalizeTimTracksArranger(row.arrangerDisplayName);
  const voicing = source.pageVoicing ?? holidayVoicingForTimTracksRow(row);

  if (!title) {
    return {
      rows: [],
      skipped: {
        sourceType: source.type,
        id: row.id ?? null,
        title: null,
        reason: "missing_title",
      },
    };
  }

  if (!arranger) {
    return {
      rows: [],
      skipped: {
        sourceType: source.type,
        id: row.id ?? null,
        title,
        reason: "missing_arranger",
      },
    };
  }

  if (!voicing) {
    return {
      rows: [],
      skipped: {
        sourceType: source.type,
        id: row.id ?? null,
        title,
        arranger,
        numMaleParts: row.numMaleParts ?? null,
        numFemaleParts: row.numFemaleParts ?? null,
        reason: "ambiguous_holiday_voicing",
      },
    };
  }

  return {
    rows: [
      {
        title,
        voicing,
        arranger,
        source: "TimTracks",
      },
    ],
    skipped: null,
  };
}

export function transformTimTracksRows(rowsBySource) {
  const rows = [];
  const skipped = [];

  for (const source of sourcePages) {
    const sourceRows = rowsBySource[source.type] ?? [];
    for (const row of sourceRows) {
      const transformed = transformTimTracksRow(row, source);
      rows.push(...transformed.rows);
      if (transformed.skipped) skipped.push(transformed.skipped);
    }
  }

  const deduped = dedupeSourceRows(rows);
  return {
    rows: deduped.rows,
    report: {
      sourceRows: Object.values(rowsBySource).reduce(
        (total, sourceRows) => total + sourceRows.length,
        0
      ),
      importedRows: deduped.rows.length,
      duplicateRows: deduped.duplicateRows,
      skippedRows: skipped.length,
      skipped,
    },
  };
}

async function fetchTimTracksSource(source) {
  const body = new URLSearchParams({
    showTracks: source.type,
    search: "",
    returnURL: source.url,
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`TimTracks ${source.type} request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error(`TimTracks ${source.type} response did not include data array.`);
  }

  return payload.data;
}

async function scrapeTimTracks() {
  const rowsBySource = {};

  for (const source of sourcePages) {
    rowsBySource[source.type] = await fetchTimTracksSource(source);
    console.log(`Fetched TimTracks ${source.type}: ${rowsBySource[source.type].length}`);
  }

  return rowsBySource;
}

async function main() {
  const outputPath = path.resolve(optionValue("output") ?? defaultOutputPath);
  const rowsBySource = await scrapeTimTracks();
  const { rows, report } = transformTimTracksRows(rowsBySource);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  await mkdir(path.dirname(skippedRowsPath), { recursive: true });
  await writeFile(skippedRowsPath, `${JSON.stringify(report.skipped, null, 2)}\n`, "utf8");

  const voicingCounts = rows.reduce((counts, row) => {
    counts[row.voicing] = (counts[row.voicing] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`TimTracks source rows: ${report.sourceRows}`);
  console.log(`TimTracks imported suggestion rows: ${report.importedRows}`);
  console.log(`TimTracks duplicate rows collapsed: ${report.duplicateRows}`);
  console.log(`TimTracks skipped rows: ${report.skippedRows}`);
  console.log(
    `TimTracks imported rows by voicing: ${Object.entries(voicingCounts)
      .sort()
      .map(([voicing, count]) => `${voicing} ${count}`)
      .join(", ")}`
  );
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}.`);
  console.log(`Wrote ${path.relative(repoRoot, skippedRowsPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
