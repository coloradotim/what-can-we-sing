#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultCatalogPath = path.join(
  repoRoot,
  "data/song_suggestion_catalog.psv"
);
const batchSize = 500;

export function normalizeSearchText(value) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanText(value) {
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseSongSuggestionCatalog(contents) {
  const lines = contents.split(/\r?\n/).filter((line) => line.trim());
  const [header, ...rows] = lines;

  if (header !== "Song Title|Voicing|Arranger") {
    throw new Error("Expected PSV header: Song Title|Voicing|Arranger");
  }

  const deduped = new Map();

  for (const [index, row] of rows.entries()) {
    const columns = row.split("|");
    if (columns.length !== 3) {
      throw new Error(`Invalid PSV row ${index + 2}: expected 3 columns.`);
    }

    const [titleValue, voicingValue, arrangerValue] = columns;
    const title = cleanText(titleValue);
    const voicing = cleanText(voicingValue);
    const arranger = cleanText(arrangerValue);

    if (!title || !voicing) continue;

    const normalizedTitle = normalizeSearchText(title);
    const normalizedArranger = arranger ? normalizeSearchText(arranger) : null;
    const key = [normalizedTitle, voicing, normalizedArranger ?? ""].join("|");

    if (deduped.has(key)) continue;

    deduped.set(key, {
      title,
      normalized_title: normalizedTitle,
      voicing,
      arranger,
      normalized_arranger: normalizedArranger,
      source: "Barbershop Connections",
    });
  }

  return Array.from(deduped.values()).sort((a, b) => {
    return (
      a.title.localeCompare(b.title) ||
      a.voicing.localeCompare(b.voicing) ||
      (a.arranger ?? "").localeCompare(b.arranger ?? "")
    );
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function replaceCatalogRows(supabase, rows) {
  const { error: deleteError } = await supabase
    .from("song_suggestion_catalog")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) throw deleteError;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase
      .from("song_suggestion_catalog")
      .insert(batch);
    if (error) throw error;
  }
}

export async function importSongSuggestionCatalog({
  catalogPath = defaultCatalogPath,
  dryRun = false,
} = {}) {
  const contents = await readFile(catalogPath, "utf8");
  const rows = parseSongSuggestionCatalog(contents);

  if (dryRun) return { rowsImported: rows.length, dryRun: true };

  const supabaseUrl =
    process.env.SUPABASE_URL || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await replaceCatalogRows(supabase, rows);

  return { rowsImported: rows.length, dryRun: false };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const pathArg = process.argv.find((arg) => arg.startsWith("--path="));
  const catalogPath = pathArg
    ? path.resolve(pathArg.slice("--path=".length))
    : defaultCatalogPath;

  const result = await importSongSuggestionCatalog({ catalogPath, dryRun });
  console.log(
    `${dryRun ? "Parsed" : "Imported"} ${result.rowsImported} catalog rows.`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
