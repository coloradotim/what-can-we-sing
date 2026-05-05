import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  dedupeSourceRows,
  normalizeArrangerName,
  normalizeSourceVoicings,
  normalizeTitleArticle,
  normalizeTitleForSuggestionKey,
} from "../../scripts/song-sources/source-utils.mjs";
import {
  formatSourcePsv,
  parseSourcePsv,
} from "../../scripts/song-sources/psv.mjs";
import { loadSongSourcesEnv } from "../../scripts/song-sources/env.mjs";
import {
  normalizeBarbershopConnectionsRecord,
  normalizeBarbershopConnectionsVoices,
} from "../../scripts/song-sources/scrape-barbershop-connections.mjs";
import { transformHarmonyBrigadeSongRows } from "../../scripts/song-sources/import-harmony-brigade-db.mjs";
import {
  defaultSourcePaths,
  mergeRows,
} from "../../scripts/merge-song-suggestion-sources.mjs";

const tempDirs = [];

afterEach(async () => {
  for (const tempDir of tempDirs.splice(0)) {
    await rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.WCWS_TEST_SONG_SOURCE_VALUE;
});

describe("song source pipeline", () => {
  it("normalizes source title, arranger, and voicing values", () => {
    expect(normalizeTitleArticle("Mamselle, The")).toBe("The Mamselle");
    expect(normalizeArrangerName("Smith; Jones & Lee")).toBe(
      "Smith, Jones and Lee"
    );
    expect(normalizeSourceVoicings("Mens Track")).toEqual(["TTBB"]);
    expect(normalizeSourceVoicings("Women’s Track / Mixed Track")).toEqual([
      "SSAA",
      "SATB",
    ]);
  });

  it("builds article-insensitive suggestion title keys", () => {
    expect(normalizeTitleForSuggestionKey("A Barbershop Time Of Your Life")).toBe(
      "barbershop time of your life"
    );
    expect(normalizeTitleForSuggestionKey("Barbershop Time Of Your Life")).toBe(
      "barbershop time of your life"
    );
    expect(normalizeTitleForSuggestionKey("The Longest Time")).toBe(
      "longest time"
    );
    expect(normalizeTitleForSuggestionKey("Longest Time")).toBe("longest time");
    expect(normalizeTitleForSuggestionKey("An Old Song")).toBe("old song");
    expect(normalizeTitleForSuggestionKey("Old Song")).toBe("old song");
    expect(normalizeTitleForSuggestionKey("Closest Thing To Crazy, The")).toBe(
      "closest thing to crazy"
    );
    expect(normalizeTitleForSuggestionKey("The Closest Thing To Crazy")).toBe(
      "closest thing to crazy"
    );
  });

  it("writes and parses PSV rows without losing multi-voicing support", () => {
    const psv = formatSourcePsv([
      {
        title: "Pipe | Song",
        voicing: "TTBB",
        arranger: "Arranger\nName",
      },
      {
        title: "Pipe / Song",
        voicing: "SSAA",
        arranger: "Arranger Name",
      },
    ]);

    expect(psv).toContain("Pipe / Song|TTBB|Arranger Name");
    expect(parseSourcePsv("Song Title|Voicing|Arranger\nSame Song|TTBB, SATB|\n"))
      .toEqual([
        { title: "Same Song", voicing: "SATB", arranger: null, source: undefined },
        { title: "Same Song", voicing: "TTBB", arranger: null, source: undefined },
      ]);
  });

  it("dedupes article-insensitive matching title, voicing, and arranger rows", () => {
    const deduped = dedupeSourceRows([
      { title: "Song", voicing: "TTBB", arranger: null },
      { title: "Song", voicing: "TTBB", arranger: null },
      { title: "The Song", voicing: "TTBB", arranger: null },
      { title: "Song", voicing: "SSAA", arranger: null },
      { title: "Song", voicing: "TTBB", arranger: "Someone" },
      { title: "The Song", voicing: "TTBB", arranger: "Someone Else" },
    ]);

    expect(deduped.duplicateRows).toBe(2);
    expect(deduped.rows).toHaveLength(4);
  });

  it("uses Barbershop Connections Voices as app voicing", () => {
    expect(normalizeBarbershopConnectionsVoices("None specified")).toEqual([
      "TTBB",
    ]);
    expect(normalizeBarbershopConnectionsVoices("Young SSAA")).toEqual([
      "SSAA",
    ]);

    const transformed = normalizeBarbershopConnectionsRecord({
      Title: "Mam'selle",
      Arranger: "Smith, Jane",
      Voices: "SSAA",
      Voicing: "ignore this field",
    });

    expect(transformed.rows).toEqual([
      {
        title: "Mam'selle",
        voicing: "SSAA",
        arranger: "Jane Smith",
        source: "Barbershop Connections",
      },
    ]);
  });

  it("transforms Harmony Brigade DB rows into suggestion rows", () => {
    const transformed = transformHarmonyBrigadeSongRows([
      { SongTitle: "Song One", Arranger: "A. Person" },
      { SongTitle: "Song Two", Arranger: "", Voicing: "SATB" },
      { SongTitle: "", Arranger: "Skipped" },
    ]);

    expect(transformed.rows).toEqual([
      {
        title: "Song One",
        voicing: "TTBB",
        arranger: "A. Person",
        source: "Harmony Brigade",
      },
      {
        title: "Song Two",
        voicing: "SATB",
        arranger: null,
        source: "Harmony Brigade",
      },
    ]);
    expect(transformed.report.skippedRows).toBe(1);
  });

  it("merges source rows while preserving distinct voicings", () => {
    const merged = mergeRows([
      [
        { title: "Same Song", voicing: "TTBB", arranger: null },
        { title: "Same Song", voicing: "TTBB", arranger: null },
        { title: "The Same Song", voicing: "TTBB", arranger: "Arranger One" },
      ],
      [
        { title: "The Same Song", voicing: "SSAA", arranger: null },
        { title: "Same Song", voicing: "TTBB", arranger: "Arranger One" },
        { title: "Same Song", voicing: "TTBB", arranger: "Arranger Two" },
      ],
    ]);

    expect(merged.duplicateRows).toBe(2);
    expect(merged.rows).toEqual([
      { title: "Same Song", voicing: "TTBB", arranger: null },
      { title: "Same Song", voicing: "TTBB", arranger: "Arranger Two" },
      { title: "The Same Song", voicing: "SSAA", arranger: null },
      { title: "The Same Song", voicing: "TTBB", arranger: "Arranger One" },
    ]);
  });

  it("includes manual Sheet Music Plus source files when present", () => {
    expect(
      defaultSourcePaths.some((sourcePath) =>
        sourcePath.endsWith("sheet_music_plus_barbershop_song_suggestions.psv")
      )
    ).toBe(true);
  });

  it("loads local song source env without logging or requiring secrets", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "song-source-env-"));
    tempDirs.push(tempDir);
    const envPath = path.join(tempDir, ".env.song-sources.local");
    await writeFile(envPath, "WCWS_TEST_SONG_SOURCE_VALUE='loaded value'\n");

    const result = await loadSongSourcesEnv({ envPath });

    expect(result.loaded).toBe(true);
    expect(process.env.WCWS_TEST_SONG_SOURCE_VALUE).toBe("loaded value");
  });
});
