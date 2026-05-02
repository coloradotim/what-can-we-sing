#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { transformBhsPublishedMusicCatalog } from "../import-bhs-published-music.mjs";
import { formatSourcePsv } from "./psv.mjs";
import { loadSongSourcesEnv, repoRoot } from "./env.mjs";

const defaultSourcePath = path.join(repoRoot, "data/bhs_published_music_catalog.csv");
const defaultOutputPath = path.join(
  repoRoot,
  "data/sources/bhs_song_catalog_suggestions.psv"
);
const skippedRowsPath = path.join(repoRoot, "tmp/song-sources/bhs-skipped.json");

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function sourceContents(sourcePath) {
  if (/^https?:\/\//i.test(sourcePath)) {
    const response = await fetch(sourcePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch BHS catalog CSV: ${response.status}`);
    }
    return response.text();
  }

  return readFile(path.resolve(sourcePath), "utf8");
}

async function main() {
  await loadSongSourcesEnv();

  const args = new Set(process.argv.slice(2));
  const sourcePath =
    optionValue("source") ??
    process.env.BHS_CATALOG_CSV_URL ??
    process.env.BHS_CATALOG_CSV_PATH ??
    defaultSourcePath;
  const outputPath = path.resolve(optionValue("output") ?? defaultOutputPath);
  const printSkipped = args.has("--print-skipped");

  const contents = await sourceContents(sourcePath);
  const { rows, report } = transformBhsPublishedMusicCatalog(contents);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatSourcePsv(rows), "utf8");

  if (report.skippedRows > 0) {
    await mkdir(path.dirname(skippedRowsPath), { recursive: true });
    await writeFile(skippedRowsPath, JSON.stringify(report.skipped, null, 2), "utf8");
  }

  console.log(`BHS source rows: ${report.sourceRows}`);
  console.log(`BHS imported suggestion rows: ${report.importedRows}`);
  console.log(`BHS duplicate rows collapsed: ${report.duplicateRows}`);
  console.log(`BHS skipped rows: ${report.skippedRows}`);
  if (printSkipped) console.log(JSON.stringify(report.skipped.slice(0, 100), null, 2));
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
