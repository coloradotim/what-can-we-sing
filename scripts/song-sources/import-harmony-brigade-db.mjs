#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import { loadSongSourcesEnv, repoRoot, requiredEnv } from "./env.mjs";
import { formatSourcePsv } from "./psv.mjs";
import {
  cleanSourceText,
  dedupeSourceRows,
  normalizeArrangerName,
  normalizeSourceVoicings,
  normalizeTitleArticle,
} from "./source-utils.mjs";

const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/harmony_brigade_song_suggestions.psv"
);
const skippedRowsPath = path.join(
  repoRoot,
  "tmp/song-sources/harmony-brigade-skipped.json"
);

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function sqlIdentifier(value, name) {
  const identifier = cleanSourceText(value);
  if (!identifier || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid ${name}. Use an unquoted SQL identifier.`);
  }
  return `\`${identifier}\``;
}

export function transformHarmonyBrigadeSongRows(rows, { defaultVoicing = "TTBB" } = {}) {
  const sourceRows = [];
  const skipped = [];

  for (const [index, row] of rows.entries()) {
    const title = normalizeTitleArticle(
      row.song_title ?? row.SongTitle ?? row.title ?? row.Title
    );
    const arranger = normalizeArrangerName(
      row.arranger ?? row.Arranger ?? row.ArrangerName
    );
    const voicingValue =
      row.voicing ?? row.Voicing ?? row.voice ?? row.Voice ?? defaultVoicing;
    const voicings = normalizeSourceVoicings(voicingValue);

    if (!title || voicings.length === 0) {
      skipped.push({
        rowNumber: index + 1,
        title: cleanSourceText(row.SongTitle ?? row.title),
        voicing: cleanSourceText(voicingValue),
        reason: !title ? "missing_title" : "unknown_voicing",
      });
      continue;
    }

    for (const voicing of voicings) {
      sourceRows.push({
        title,
        voicing,
        arranger,
        source: "Harmony Brigade",
      });
    }
  }

  const deduped = dedupeSourceRows(sourceRows);
  return {
    rows: deduped.rows,
    report: {
      sourceRows: rows.length,
      importedRows: deduped.rows.length,
      duplicateRows: deduped.duplicateRows,
      skippedRows: skipped.length,
      skipped,
    },
  };
}

async function fetchHarmonyBrigadeRows() {
  const connection = await mysql.createConnection({
    host: requiredEnv("HB_MYSQL_HOST"),
    port: Number(process.env.HB_MYSQL_PORT ?? 3306),
    user: requiredEnv("HB_MYSQL_USER"),
    password: requiredEnv("HB_MYSQL_PASSWORD"),
    database: requiredEnv("HB_MYSQL_DATABASE"),
  });

  try {
    const table = sqlIdentifier(
      process.env.HB_MYSQL_SONG_TABLE || "SongData",
      "HB_MYSQL_SONG_TABLE"
    );
    const titleColumn = sqlIdentifier(
      process.env.HB_MYSQL_TITLE_COLUMN || "SongTitle",
      "HB_MYSQL_TITLE_COLUMN"
    );
    const arrangerColumn = sqlIdentifier(
      process.env.HB_MYSQL_ARRANGER_COLUMN || "Arranger",
      "HB_MYSQL_ARRANGER_COLUMN"
    );
    const voicingColumn = process.env.HB_MYSQL_VOICING_COLUMN;
    const columns = voicingColumn
      ? `${titleColumn} as SongTitle, ${arrangerColumn} as Arranger, ${sqlIdentifier(
          voicingColumn,
          "HB_MYSQL_VOICING_COLUMN"
        )} as Voicing`
      : `${titleColumn} as SongTitle, ${arrangerColumn} as Arranger`;
    const [rows] = await connection.query(
      `select ${columns} from ${table} order by ${titleColumn}`
    );
    return rows;
  } finally {
    await connection.end();
  }
}

async function main() {
  await loadSongSourcesEnv();

  const outputPath = path.resolve(optionValue("output") ?? defaultOutputPath);
  const defaultVoicing = optionValue("default-voicing") ?? "TTBB";
  const sourceRows = await fetchHarmonyBrigadeRows();
  const { rows, report } = transformHarmonyBrigadeSongRows(sourceRows, {
    defaultVoicing,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  if (report.skippedRows > 0) {
    await mkdir(path.dirname(skippedRowsPath), { recursive: true });
    await writeFile(skippedRowsPath, JSON.stringify(report.skipped, null, 2), "utf8");
  }

  console.log(`Harmony Brigade source rows: ${report.sourceRows}`);
  console.log(`Harmony Brigade imported suggestion rows: ${report.importedRows}`);
  console.log(`Harmony Brigade duplicate rows collapsed: ${report.duplicateRows}`);
  console.log(`Harmony Brigade skipped rows: ${report.skippedRows}`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
