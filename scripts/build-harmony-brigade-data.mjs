#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultSourcePath = path.join(repoRoot, "data/harmony_brigade_songs.csv");
const defaultOutputPath = path.join(repoRoot, "data/harmony_brigade_songs.json");
const expectedHeader = [
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
];

function cleanText(value) {
  const trimmed = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed || trimmed === "--" || trimmed.toUpperCase() === "NULL") {
    return null;
  }
  return trimmed;
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
      if (
        char === '"' &&
        nextChar === '"' &&
        (contents[index + 2] === "," ||
          contents[index + 2] === "\n" ||
          contents[index + 2] === "\r" ||
          !contents[index + 2])
      ) {
        field += '"';
        quoted = false;
        index += 1;
      } else if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
      } else if (
        char === '"' &&
        (nextChar === "," || nextChar === "\n" || nextChar === "\r" || !nextChar)
      ) {
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

export function parseHarmonyBrigadeCsv(contents) {
  const [header, ...rows] = parseCsv(contents).filter((row) =>
    row.some((field) => field.trim())
  );

  if (!header || header.join("|") !== expectedHeader.join("|")) {
    throw new Error(
      `Expected Harmony Brigade CSV header: ${expectedHeader.join(",")}`
    );
  }

  const deduped = new Map();

  for (const [index, row] of rows.entries()) {
    if (row.length !== expectedHeader.length) {
      throw new Error(
        `Invalid Harmony Brigade CSV row ${index + 2}: expected ${expectedHeader.length} columns.`
      );
    }

    const songId = cleanText(row[0]);
    const title = cleanText(row[1]);
    if (!songId || !title) continue;

    const sourceRow = {
      id: songId,
      title,
      voicing: "TTBB",
      arranger: cleanText(row[3]),
      eventYear: null,
      eventName: "Ross Wilkins song database",
      sourceName: "Ross Wilkins' Harmony Brigade song database",
      keyName: cleanText(row[2]),
      asSungBy: cleanText(row[4]),
      learningTrackProvider: cleanText(row[5]),
      songStyle: cleanText(row[6]),
      songLength: cleanText(row[7]),
      difficulty: cleanText(row[8]),
      genre: cleanText(row[9]),
      tempo: cleanText(row[10]),
      startingWords: cleanText(row[11]),
    };

    deduped.set(sourceRow.id, sourceRow);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    return (
      a.title.localeCompare(b.title) ||
      (a.arranger ?? "").localeCompare(b.arranger ?? "") ||
      a.id.localeCompare(b.id)
    );
  });
}

export async function buildHarmonyBrigadeData({
  sourcePath = defaultSourcePath,
  outputPath = defaultOutputPath,
} = {}) {
  const contents = await readFile(sourcePath, "utf8");
  const songs = parseHarmonyBrigadeCsv(contents);
  await writeFile(outputPath, `${JSON.stringify(songs, null, 2)}\n`);
  return { songsWritten: songs.length, outputPath };
}

async function main() {
  const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const sourcePath = sourceArg
    ? path.resolve(sourceArg.slice("--source=".length))
    : defaultSourcePath;
  const outputPath = outputArg
    ? path.resolve(outputArg.slice("--output=".length))
    : defaultOutputPath;

  const result = await buildHarmonyBrigadeData({ sourcePath, outputPath });
  console.log(`Wrote ${result.songsWritten} Harmony Brigade songs.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
