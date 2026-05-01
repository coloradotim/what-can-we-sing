#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  cleanText,
  normalizeSearchText,
  parseCsv,
} from "./harmony-brigade-csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultSourceDir = path.join(repoRoot, "data/harmony-brigade");
const batchSize = 500;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sourceDirFromArgs(args) {
  const pathArg = args.find((arg) => arg.startsWith("--path="));
  return pathArg
    ? path.resolve(pathArg.slice("--path=".length))
    : defaultSourceDir;
}

function hasArg(name) {
  return process.argv.slice(2).includes(name);
}

async function readCsv(filePath) {
  return parseCsv(await readFile(filePath, "utf8"));
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseHarmonyBrigadeSnapshots({
  songDataRows,
  historyRows,
  brigadeRows,
}) {
  const brigades = new Map();
  for (const row of brigadeRows) {
    const abbr = cleanText(row.BrigadeAbbr);
    if (!abbr) continue;

    brigades.set(abbr, {
      brigade_abbr: abbr,
      brigade_name: cleanText(row.BrigadeName),
      month_held: numberOrNull(row.MonthHeld),
      website: cleanText(row.Website),
    });
  }

  const songsById = new Map();
  for (const row of songDataRows) {
    const sourceSongId = numberOrNull(row.SongID);
    const title = cleanText(row.SongTitle);
    if (!sourceSongId || !title) continue;

    const arranger = cleanText(row.Arranger);
    songsById.set(sourceSongId, {
      source_song_id: sourceSongId,
      song_title: title,
      normalized_title: normalizeSearchText(title),
      arranger,
      normalized_arranger: arranger ? normalizeSearchText(arranger) : null,
      default_voicing: "TTBB",
      song_key: cleanText(row.KeyName),
      starting_words: cleanText(row.StartingWords),
      as_sung_by: cleanText(row.AsSungBy),
      learning_track_provider: cleanText(row.LT_Provider),
      song_style: cleanText(row.SongStyle),
      song_length: cleanText(row.SongLength),
      difficulty: cleanText(row.Difficulty),
      genre: cleanText(row.Genre),
      tempo: cleanText(row.Tempo),
    });
  }

  const events = new Map();
  const eventSongs = new Map();
  let missingSongCount = 0;

  for (const row of historyRows) {
    const sourceSongId = numberOrNull(row.SongID);
    const yearHeld = numberOrNull(row.YearHeld);
    const brigadeAbbr = cleanText(row.BrigadeAbbr);
    if (!sourceSongId || !yearHeld || !brigadeAbbr) continue;

    if (!songsById.has(sourceSongId)) {
      missingSongCount += 1;
      const title = cleanText(row.SongTitle);
      if (!title) continue;
      const arranger = cleanText(row.Arranger);
      songsById.set(sourceSongId, {
        source_song_id: sourceSongId,
        song_title: title,
        normalized_title: normalizeSearchText(title),
        arranger,
        normalized_arranger: arranger ? normalizeSearchText(arranger) : null,
        default_voicing: "TTBB",
        song_key: cleanText(row.KeyName),
        starting_words: cleanText(row.StartingWords),
        as_sung_by: cleanText(row.AsSungBy),
        learning_track_provider: cleanText(row.LT_Provider),
        song_style: cleanText(row.SongStyle),
        song_length: cleanText(row.SongLength),
        difficulty: null,
        genre: null,
        tempo: null,
      });
    }

    const brigade = brigades.get(brigadeAbbr);
    const eventKey = `${yearHeld}|${brigadeAbbr}`;
    events.set(eventKey, {
      year_held: yearHeld,
      brigade_abbr: brigadeAbbr,
      brigade_name: brigade?.brigade_name ?? null,
      event_label: brigade?.brigade_name
        ? `${yearHeld} ${brigade.brigade_name} (${brigadeAbbr})`
        : `${yearHeld} ${brigadeAbbr}`,
    });

    eventSongs.set(`${eventKey}|${sourceSongId}`, {
      eventKey,
      source_song_id: sourceSongId,
      track_number: numberOrNull(row.CDTrackNum),
    });
  }

  return {
    songs: Array.from(songsById.values()).sort((a, b) => a.source_song_id - b.source_song_id),
    events: Array.from(events.values()).sort((a, b) => {
      return b.year_held - a.year_held || a.brigade_abbr.localeCompare(b.brigade_abbr);
    }),
    eventSongs: Array.from(eventSongs.values()),
    missingSongCount,
    missingArrangerCount: Array.from(songsById.values()).filter((song) => !song.arranger).length,
  };
}

async function upsertInBatches(supabase, table, rows, options) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase.from(table).upsert(batch, options);
    if (error) throw error;
  }
}

async function deleteAllRows(supabase, table) {
  const { error } = await supabase
    .from(table)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
}

export async function importHarmonyBrigadeSongs({
  sourceDir = defaultSourceDir,
  dryRun = false,
} = {}) {
  const [songDataRows, historyRows, brigadeRows] = await Promise.all([
    readCsv(path.join(sourceDir, "song_data.csv")),
    readCsv(path.join(sourceDir, "view_history.csv")),
    readCsv(path.join(sourceDir, "brigades.csv")),
  ]);

  const parsed = parseHarmonyBrigadeSnapshots({
    songDataRows,
    historyRows,
    brigadeRows,
  });

  if (dryRun) {
    return { ...parsed, dryRun: true };
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await upsertInBatches(supabase, "harmony_brigade_songs", parsed.songs, {
    onConflict: "source_song_id",
  });
  await upsertInBatches(supabase, "harmony_brigade_events", parsed.events, {
    onConflict: "year_held,brigade_abbr",
  });

  const [{ data: songRows, error: songError }, { data: eventRows, error: eventError }] =
    await Promise.all([
      supabase.from("harmony_brigade_songs").select("id,source_song_id"),
      supabase.from("harmony_brigade_events").select("id,year_held,brigade_abbr"),
    ]);
  if (songError) throw songError;
  if (eventError) throw eventError;

  const songIds = new Map(songRows.map((row) => [row.source_song_id, row.id]));
  const eventIds = new Map(
    eventRows.map((row) => [`${row.year_held}|${row.brigade_abbr}`, row.id])
  );

  const joinRows = parsed.eventSongs
    .map((row, index) => ({
      event_id: eventIds.get(row.eventKey),
      song_id: songIds.get(row.source_song_id),
      track_number: row.track_number,
      sort_order: row.track_number ?? index + 1,
    }))
    .filter((row) => row.event_id && row.song_id);

  await deleteAllRows(supabase, "harmony_brigade_event_songs");
  await upsertInBatches(supabase, "harmony_brigade_event_songs", joinRows, {
    onConflict: "event_id,song_id",
  });

  return {
    ...parsed,
    eventSongsImported: joinRows.length,
    dryRun: false,
  };
}

async function main() {
  const sourceDir = sourceDirFromArgs(process.argv.slice(2));
  const dryRun = hasArg("--dry-run");
  const result = await importHarmonyBrigadeSongs({ sourceDir, dryRun });

  console.log(`${dryRun ? "Parsed" : "Imported"} Harmony Brigade source.`);
  console.log(`Songs: ${result.songs.length}`);
  console.log(`Events: ${result.events.length}`);
  console.log(`Event-song rows: ${result.eventSongsImported ?? result.eventSongs.length}`);
  console.log(`Missing arrangers: ${result.missingArrangerCount}`);
  console.log(`History rows missing SongData match: ${result.missingSongCount}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
