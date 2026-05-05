#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { formatSongSuggestionCatalog } from "./import-bhs-published-music.mjs";
import { parseSongSuggestionCatalog } from "./import-song-suggestions.mjs";
import {
  normalizeSuggestionText,
  normalizeTitleForSuggestionKey,
} from "./song-sources/source-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultCatalogPath = path.join(
  repoRoot,
  "data/song_suggestion_catalog.psv"
);
const defaultBackupDir = path.join(repoRoot, "data/backups");
export const defaultSourcePaths = [
  path.join(repoRoot, "data/sources/barbershop_connections_song_suggestions.psv"),
  path.join(repoRoot, "data/sources/barbershoptracks_song_suggestions.psv"),
  path.join(repoRoot, "data/sources/timtracks_song_suggestions.psv"),
  path.join(repoRoot, "data/sources/kohl_kitzmiller_music_song_suggestions.psv"),
  path.join(repoRoot, "data/sources/bhs_song_catalog_suggestions.psv"),
  path.join(
    repoRoot,
    "data/sources/sweet_adelines_published_music_song_suggestions.psv"
  ),
  path.join(
    repoRoot,
    "data/sources/sweet_adelines_arranged_music_song_suggestions.psv"
  ),
  path.join(repoRoot, "data/sources/harmony_brigade_song_suggestions.psv"),
];

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

export function timestamp() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `${date}-${time}`;
}

function catalogKey(row) {
  return [
    normalizeTitleForSuggestionKey(row.title),
    row.voicing,
    normalizeSuggestionText(row.arranger ?? ""),
  ].join("|");
}

function preferredCatalogTitle(current, next) {
  if (next.length > current.length) return next;
  if (next.length < current.length) return current;
  return current.localeCompare(next) <= 0 ? current : next;
}

export function mergeRows(rowSets) {
  const deduped = new Map();
  let duplicateRows = 0;

  for (const rows of rowSets) {
    for (const row of rows) {
      const key = catalogKey(row);
      if (deduped.has(key)) {
        duplicateRows += 1;
        const existing = deduped.get(key);
        existing.title = preferredCatalogTitle(existing.title, row.title);
        continue;
      }
      deduped.set(key, row);
    }
  }

  return {
    rows: Array.from(deduped.values()).sort((a, b) => {
      return (
        a.title.localeCompare(b.title) ||
        a.voicing.localeCompare(b.voicing) ||
        String(a.arranger ?? "").localeCompare(String(b.arranger ?? ""))
      );
    }),
    duplicateRows,
  };
}

async function readCatalogRows(filePath) {
  const contents = await readFile(filePath, "utf8");
  return {
    contents,
    rows: parseSongSuggestionCatalog(contents),
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const catalogPath = path.resolve(optionValue("catalog") ?? defaultCatalogPath);
  const backupDir = path.resolve(optionValue("backup-dir") ?? defaultBackupDir);
  const sourceArgs = process.argv
    .filter((arg) => arg.startsWith("--source="))
    .map((arg) => path.resolve(arg.slice("--source=".length)));
  const sourcePaths = sourceArgs.length > 0 ? sourceArgs : defaultSourcePaths;

  const existing = await readCatalogRows(catalogPath);
  const sourceRows = [];

  for (const sourcePath of sourcePaths) {
    if (!(await fileExists(sourcePath))) {
      console.log(`Skipping missing source: ${path.relative(repoRoot, sourcePath)}`);
      continue;
    }
    const source = await readCatalogRows(sourcePath);
    sourceRows.push(source.rows);
    console.log(`${path.relative(repoRoot, sourcePath)} rows: ${source.rows.length}`);
  }

  const merged = mergeRows([existing.rows, ...sourceRows]);
  console.log(`${path.relative(repoRoot, catalogPath)} rows: ${existing.rows.length}`);
  console.log(`Merged catalog rows: ${merged.rows.length}`);
  console.log(`Duplicate rows collapsed: ${merged.duplicateRows}`);

  if (dryRun) {
    console.log("Dry run complete. Catalog was not written.");
    return;
  }

  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `song_suggestion_catalog.${timestamp()}.psv`
  );
  await writeFile(backupPath, existing.contents, "utf8");
  await writeFile(catalogPath, formatSongSuggestionCatalog(merged.rows), "utf8");

  console.log(`Backed up previous catalog to ${path.relative(repoRoot, backupPath)}.`);
  console.log(`Wrote ${path.relative(repoRoot, catalogPath)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
