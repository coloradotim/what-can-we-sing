#!/usr/bin/env node

import mysql from "mysql2/promise";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { rowsToCsv } from "./harmony-brigade-csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultOutputDir = path.join(repoRoot, "data/harmony-brigade");

const sourceDefaults = {
  host: process.env.HB_MYSQL_HOST || "gud2brabah.com",
  port: Number(process.env.HB_MYSQL_PORT || 3306),
  database: process.env.HB_MYSQL_DATABASE || "XQHistory",
  user: process.env.HB_MYSQL_USER || "XQMember",
};

const exportSpecs = [
  {
    table: "SongData",
    output: "song_data.csv",
    query:
      "SELECT SongID, SongTitle, KeyName, Arranger, AsSungBy, LT_Provider, SongStyle, SongLength, Difficulty, Genre, Tempo, StartingWords FROM SongData ORDER BY SongTitle, SongID",
    columns: [
      "SongID",
      "SongTitle",
      "KeyName",
      "Arranger",
      "AsSungBy",
      "LT_Provider",
      "SongStyle",
      "SongLength",
      "Difficulty",
      "Genre",
      "Tempo",
      "StartingWords",
    ],
  },
  {
    table: "ViewHistory",
    output: "view_history.csv",
    query:
      "SELECT SongID, YearHeld, BrigadeAbbr, SongTitle, KeyName, CDTrackNum, Arranger, AsSungBy, LT_Provider, SongStyle, SongLength, StartingWords FROM ViewHistory ORDER BY YearHeld DESC, BrigadeAbbr, COALESCE(CDTrackNum, 999), SongTitle, SongID",
    columns: [
      "SongID",
      "YearHeld",
      "BrigadeAbbr",
      "SongTitle",
      "KeyName",
      "CDTrackNum",
      "Arranger",
      "AsSungBy",
      "LT_Provider",
      "SongStyle",
      "SongLength",
      "StartingWords",
    ],
  },
  {
    table: "XQ_Brigades",
    output: "brigades.csv",
    query:
      "SELECT Brigade_ID, BrigadeAbbr, BrigadeName, MonthHeld, Website FROM XQ_Brigades ORDER BY BrigadeAbbr",
    columns: [
      "Brigade_ID",
      "BrigadeAbbr",
      "BrigadeName",
      "MonthHeld",
      "Website",
    ],
  },
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function outputDirFromArgs(args) {
  const pathArg = args.find((arg) => arg.startsWith("--out="));
  return pathArg ? path.resolve(pathArg.slice("--out=".length)) : defaultOutputDir;
}

function countMissing(rows, column) {
  return rows.filter((row) => !String(row[column] ?? "").trim()).length;
}

export async function exportHarmonyBrigadeSource({
  outputDir = defaultOutputDir,
} = {}) {
  const connection = await mysql.createConnection({
    ...sourceDefaults,
    password: requiredEnv("HB_MYSQL_PASSWORD"),
  });

  await mkdir(outputDir, { recursive: true });

  const summary = {
    outputDir,
    files: [],
    distinctYears: [],
    distinctBrigades: [],
    missingArrangers: 0,
  };

  try {
    const exported = {};

    for (const spec of exportSpecs) {
      const [rows] = await connection.query(spec.query);
      const outputPath = path.join(outputDir, spec.output);
      await writeFile(outputPath, rowsToCsv(rows, spec.columns), "utf8");

      exported[spec.table] = rows;
      summary.files.push({
        table: spec.table,
        path: path.relative(repoRoot, outputPath),
        rows: rows.length,
      });
    }

    const historyRows = exported.ViewHistory ?? [];
    summary.distinctYears = Array.from(
      new Set(historyRows.map((row) => Number(row.YearHeld)).filter(Boolean))
    ).sort((a, b) => b - a);
    summary.distinctBrigades = Array.from(
      new Set(historyRows.map((row) => String(row.BrigadeAbbr ?? "").trim()).filter(Boolean))
    ).sort();
    summary.missingArrangers = countMissing(exported.SongData ?? [], "Arranger");

    return summary;
  } finally {
    await connection.end();
  }
}

async function main() {
  const outputDir = outputDirFromArgs(process.argv.slice(2));
  const summary = await exportHarmonyBrigadeSource({ outputDir });

  for (const file of summary.files) {
    console.log(`Exported ${file.rows} ${file.table} rows to ${file.path}.`);
  }
  console.log(`Distinct years: ${summary.distinctYears.length}`);
  console.log(`Distinct brigades: ${summary.distinctBrigades.join(", ")}`);
  console.log(`Missing arrangers in SongData: ${summary.missingArrangers}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
