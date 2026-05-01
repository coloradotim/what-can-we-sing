import harmonyBrigadeSongs from "@/data/harmony_brigade_songs.json";
import type { Confidence, Part, PartConfidence, Voicing } from "@/lib/matching";
import type { RepertoireRow } from "@/lib/repertoireStore";

export const HARMONY_BRIGADE_SOURCE =
  "Ross Wilkins' Harmony Brigade song database";
export const HARMONY_BRIGADE_DEFAULT_VOICING = "TTBB" satisfies Voicing;
export const HARMONY_BRIGADE_UNKNOWN_YEAR = "All years";

export type HarmonyBrigadeSong = {
  id: string;
  title: string;
  voicing: typeof HARMONY_BRIGADE_DEFAULT_VOICING;
  arranger: string | null;
  eventYear: string | null;
  eventName: string;
  sourceName: string;
  keyName: string | null;
  asSungBy: string | null;
  learningTrackProvider: string | null;
  songStyle: string | null;
  songLength: string | null;
  difficulty: string | null;
  genre: string | null;
  tempo: string | null;
  startingWords: string | null;
};

export type HarmonyBrigadeEvent = {
  key: string;
  year: string | null;
  yearLabel: string;
  eventName: string;
  songCount: number;
};

export type HarmonyBrigadeCandidate = HarmonyBrigadeSong & {
  duplicateStatus: "eligible" | "exact";
};

export type HarmonyBrigadeAddInput = {
  songTitle: string;
  voicing: typeof HARMONY_BRIGADE_DEFAULT_VOICING;
  arrangerName?: string;
  partConfidences: PartConfidence[];
};

const songs = harmonyBrigadeSongs as HarmonyBrigadeSong[];

function normalizeSongText(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function exactSongKey(input: {
  songTitle: string;
  voicing: Voicing;
  arrangerName?: string | null;
}) {
  return [
    normalizeSongText(input.songTitle),
    input.voicing,
    input.arrangerName?.trim()
      ? normalizeSongText(input.arrangerName)
      : "__blank_arranger__",
  ].join("|");
}

function eventKey(year: string | null, eventName: string) {
  return `${year ?? HARMONY_BRIGADE_UNKNOWN_YEAR}|${eventName}`;
}

export function getHarmonyBrigadeSongs() {
  return songs;
}

export function getHarmonyBrigadeEvents(
  sourceSongs: HarmonyBrigadeSong[] = songs
): HarmonyBrigadeEvent[] {
  const events = new Map<string, HarmonyBrigadeEvent>();

  for (const song of sourceSongs) {
    const key = eventKey(song.eventYear, song.eventName);
    const current = events.get(key);
    if (current) {
      current.songCount += 1;
      continue;
    }

    events.set(key, {
      key,
      year: song.eventYear,
      yearLabel: song.eventYear ?? HARMONY_BRIGADE_UNKNOWN_YEAR,
      eventName: song.eventName,
      songCount: 1,
    });
  }

  return Array.from(events.values()).sort((a, b) => {
    return (
      b.yearLabel.localeCompare(a.yearLabel) ||
      a.eventName.localeCompare(b.eventName)
    );
  });
}

export function getHarmonyBrigadeSongsForEvent(
  year: string | null,
  eventName: string,
  sourceSongs: HarmonyBrigadeSong[] = songs
) {
  return sourceSongs.filter(
    (song) => song.eventYear === year && song.eventName === eventName
  );
}

export function resolveHarmonyBrigadeCandidates(
  sourceSongs: HarmonyBrigadeSong[],
  myRepertoire: Pick<RepertoireRow, "song_title" | "voicing" | "arranger_name">[]
): HarmonyBrigadeCandidate[] {
  const existingExactKeys = new Set(
    myRepertoire.map((item) =>
      exactSongKey({
        songTitle: item.song_title,
        voicing: item.voicing,
        arrangerName: item.arranger_name,
      })
    )
  );

  return sourceSongs.map((song) => {
    const exactKey = exactSongKey({
      songTitle: song.title,
      voicing: song.voicing,
      arrangerName: song.arranger,
    });

    return {
      ...song,
      duplicateStatus: existingExactKeys.has(exactKey) ? "exact" : "eligible",
    };
  });
}

export function searchHarmonyBrigadeCandidates(
  candidates: HarmonyBrigadeCandidate[],
  query: string
) {
  const normalizedQuery = normalizeSongText(query);
  if (!normalizedQuery) return candidates;

  return candidates.filter((song) => {
    return [
      song.title,
      song.arranger,
      song.asSungBy,
      song.learningTrackProvider,
      song.startingWords,
    ].some((value) => normalizeSongText(value).includes(normalizedQuery));
  });
}

export function buildHarmonyBrigadeAddInputs(
  candidates: HarmonyBrigadeCandidate[],
  selectedIds: Set<string>,
  part: Part,
  confidence: Confidence
): HarmonyBrigadeAddInput[] {
  return candidates
    .filter(
      (song) => selectedIds.has(song.id) && song.duplicateStatus === "eligible"
    )
    .map((song) => ({
      songTitle: song.title,
      voicing: HARMONY_BRIGADE_DEFAULT_VOICING,
      arrangerName: song.arranger ?? undefined,
      partConfidences: [
        {
          part,
          confidence,
        },
      ],
    }));
}
