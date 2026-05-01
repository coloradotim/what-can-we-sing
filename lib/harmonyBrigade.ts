import type { Confidence, Part, PartConfidence } from "@/lib/matching";
import type { RepertoireRow } from "@/lib/repertoireStore";

export const HARMONY_BRIGADE_SOURCE =
  "Ross Wilkins' Harmony Brigade song database";
export const HARMONY_BRIGADE_DEFAULT_VOICING = "TTBB" as const;
export const HARMONY_BRIGADE_ALL_YEARS = "All years";
export const HARMONY_BRIGADE_ALL_BRIGADES = "All brigades";

export type HarmonyBrigadeEvent = {
  id: string;
  yearHeld: number;
  brigadeAbbr: string;
  brigadeName: string | null;
  eventLabel: string;
};

export type HarmonyBrigadeSong = {
  id: string;
  sourceSongId: number;
  songTitle: string;
  arranger: string | null;
  defaultVoicing: typeof HARMONY_BRIGADE_DEFAULT_VOICING;
  songKey: string | null;
  startingWords: string | null;
  asSungBy: string | null;
  learningTrackProvider: string | null;
  songStyle: string | null;
  songLength: string | null;
};

export type HarmonyBrigadeEventSong = {
  event: HarmonyBrigadeEvent;
  song: HarmonyBrigadeSong;
  trackNumber: number | null;
  sortOrder: number | null;
};

export type HarmonyBrigadeCandidate = HarmonyBrigadeEventSong & {
  duplicateStatus: "eligible" | "exact";
};

export type HarmonyBrigadeAddInput = {
  songTitle: string;
  voicing: typeof HARMONY_BRIGADE_DEFAULT_VOICING;
  arrangerName?: string;
  partConfidences: PartConfidence[];
};

type RawHarmonyBrigadeEvent = {
  id: string;
  year_held: number;
  brigade_abbr: string;
  brigade_name: string | null;
  event_label: string;
};

type RawHarmonyBrigadeSong = {
  id: string;
  source_song_id: number;
  song_title: string;
  arranger: string | null;
  default_voicing: typeof HARMONY_BRIGADE_DEFAULT_VOICING;
  song_key: string | null;
  starting_words: string | null;
  as_sung_by: string | null;
  learning_track_provider: string | null;
  song_style: string | null;
  song_length: string | null;
};

type RawHarmonyBrigadeEventSong = {
  track_number: number | null;
  sort_order: number | null;
  event: RawHarmonyBrigadeEvent | RawHarmonyBrigadeEvent[];
  song: RawHarmonyBrigadeSong | RawHarmonyBrigadeSong[];
};

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
  arrangerName?: string | null;
}) {
  return [
    normalizeSongText(input.songTitle),
    HARMONY_BRIGADE_DEFAULT_VOICING,
    input.arrangerName?.trim()
      ? normalizeSongText(input.arrangerName)
      : "__blank_arranger__",
  ].join("|");
}

function firstRelated<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function mapEvent(row: RawHarmonyBrigadeEvent): HarmonyBrigadeEvent {
  return {
    id: row.id,
    yearHeld: row.year_held,
    brigadeAbbr: row.brigade_abbr,
    brigadeName: row.brigade_name,
    eventLabel: row.event_label,
  };
}

function mapSong(row: RawHarmonyBrigadeSong): HarmonyBrigadeSong {
  return {
    id: row.id,
    sourceSongId: row.source_song_id,
    songTitle: row.song_title,
    arranger: row.arranger,
    defaultVoicing: row.default_voicing,
    songKey: row.song_key,
    startingWords: row.starting_words,
    asSungBy: row.as_sung_by,
    learningTrackProvider: row.learning_track_provider,
    songStyle: row.song_style,
    songLength: row.song_length,
  };
}

export function harmonyBrigadeEventDisplayName(
  event: Pick<HarmonyBrigadeEvent, "brigadeAbbr" | "brigadeName">
) {
  return event.brigadeName
    ? `${event.brigadeName} (${event.brigadeAbbr})`
    : event.brigadeAbbr;
}

export function getHarmonyBrigadeYearOptions(events: HarmonyBrigadeEvent[]) {
  return [
    HARMONY_BRIGADE_ALL_YEARS,
    ...Array.from(new Set(events.map((event) => event.yearHeld))).sort(
      (a, b) => b - a
    ),
  ];
}

export function getHarmonyBrigadeBrigadeOptions(
  selectedYear: string | number,
  events: HarmonyBrigadeEvent[]
) {
  const year =
    selectedYear === HARMONY_BRIGADE_ALL_YEARS ? null : Number(selectedYear);
  const availableEvents = year
    ? events.filter((event) => event.yearHeld === year)
    : events;
  const brigades = new Map<
    string,
    Pick<HarmonyBrigadeEvent, "brigadeAbbr" | "brigadeName">
  >();

  for (const event of availableEvents) {
    if (!brigades.has(event.brigadeAbbr)) {
      brigades.set(event.brigadeAbbr, {
        brigadeAbbr: event.brigadeAbbr,
        brigadeName: event.brigadeName,
      });
    }
  }

  return [
    { value: HARMONY_BRIGADE_ALL_BRIGADES, label: HARMONY_BRIGADE_ALL_BRIGADES },
    ...Array.from(brigades.values())
      .sort((a, b) => a.brigadeAbbr.localeCompare(b.brigadeAbbr))
      .map((event) => ({
        value: event.brigadeAbbr,
        label: harmonyBrigadeEventDisplayName(event),
      })),
  ];
}

export function filterHarmonyBrigadeSongs(
  rows: HarmonyBrigadeEventSong[],
  selectedYear: string | number,
  selectedBrigade: string
) {
  const year =
    selectedYear === HARMONY_BRIGADE_ALL_YEARS ? null : Number(selectedYear);
  const brigade =
    selectedBrigade === HARMONY_BRIGADE_ALL_BRIGADES ? null : selectedBrigade;

  return rows.filter((row) => {
    if (year && row.event.yearHeld !== year) return false;
    if (brigade && row.event.brigadeAbbr !== brigade) return false;
    return true;
  });
}

export function dedupeHarmonyBrigadeSongs(rows: HarmonyBrigadeEventSong[]) {
  const uniqueRows = new Map<string, HarmonyBrigadeEventSong>();

  for (const row of rows) {
    if (!uniqueRows.has(row.song.id)) {
      uniqueRows.set(row.song.id, row);
    }
  }

  return Array.from(uniqueRows.values());
}

export function harmonyBrigadeSelectionDescription(
  selectedYear: string | number,
  selectedBrigade: string,
  count: number,
  events: HarmonyBrigadeEvent[]
) {
  const noun = count === 1 ? "song" : "songs";
  const yearLabel = String(selectedYear);
  const brigadeOption = getHarmonyBrigadeBrigadeOptions(
    HARMONY_BRIGADE_ALL_YEARS,
    events
  ).find((event) => event.value === selectedBrigade);
  const brigadeLabel = brigadeOption?.label ?? selectedBrigade;

  if (
    selectedYear === HARMONY_BRIGADE_ALL_YEARS &&
    selectedBrigade === HARMONY_BRIGADE_ALL_BRIGADES
  ) {
    return `We found ${count} Harmony Brigade ${noun}.`;
  }

  if (selectedYear === HARMONY_BRIGADE_ALL_YEARS) {
    return `We found ${count} ${noun} for all ${brigadeLabel} events.`;
  }

  if (selectedBrigade === HARMONY_BRIGADE_ALL_BRIGADES) {
    return `We found ${count} ${noun} from ${yearLabel}.`;
  }

  return `We found ${count} ${noun} for ${yearLabel} ${brigadeLabel}.`;
}

export function resolveHarmonyBrigadeCandidates(
  sourceRows: HarmonyBrigadeEventSong[],
  myRepertoire: Pick<RepertoireRow, "song_title" | "voicing" | "arranger_name">[]
): HarmonyBrigadeCandidate[] {
  const existingExactKeys = new Set(
    myRepertoire
      .filter((item) => item.voicing === HARMONY_BRIGADE_DEFAULT_VOICING)
      .map((item) =>
        exactSongKey({
          songTitle: item.song_title,
          arrangerName: item.arranger_name,
        })
      )
  );

  return sourceRows.map((row) => ({
    ...row,
    duplicateStatus: existingExactKeys.has(
      exactSongKey({
        songTitle: row.song.songTitle,
        arrangerName: row.song.arranger,
      })
    )
      ? "exact"
      : "eligible",
  }));
}

export function searchHarmonyBrigadeCandidates(
  candidates: HarmonyBrigadeCandidate[],
  query: string
) {
  const normalizedQuery = normalizeSongText(query);
  if (!normalizedQuery) return candidates;

  return candidates.filter((row) => {
    return [
      row.song.songTitle,
      row.song.arranger,
      row.song.asSungBy,
      row.song.learningTrackProvider,
      row.song.startingWords,
      row.event.brigadeAbbr,
      row.event.brigadeName,
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
      (row) =>
        selectedIds.has(row.song.id) && row.duplicateStatus === "eligible"
    )
    .map((row) => ({
      songTitle: row.song.songTitle,
      voicing: HARMONY_BRIGADE_DEFAULT_VOICING,
      arrangerName: row.song.arranger ?? undefined,
      partConfidences: [
        {
          part,
          confidence,
        },
      ],
    }));
}

export async function getHarmonyBrigadeEvents() {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("harmony_brigade_events")
    .select("id,year_held,brigade_abbr,brigade_name,event_label")
    .order("year_held", { ascending: false })
    .order("brigade_abbr", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as RawHarmonyBrigadeEvent[]).map(mapEvent);
}

export async function getHarmonyBrigadeEventSongs() {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("harmony_brigade_event_songs")
    .select(
      "track_number,sort_order,event:harmony_brigade_events(id,year_held,brigade_abbr,brigade_name,event_label),song:harmony_brigade_songs(id,source_song_id,song_title,arranger,default_voicing,song_key,starting_words,as_sung_by,learning_track_provider,song_style,song_length)"
    )
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as RawHarmonyBrigadeEventSong[])
    .map((row) => ({
      event: mapEvent(firstRelated(row.event)),
      song: mapSong(firstRelated(row.song)),
      trackNumber: row.track_number,
      sortOrder: row.sort_order,
    }))
    .sort((a, b) => {
      return (
        b.event.yearHeld - a.event.yearHeld ||
        a.event.brigadeAbbr.localeCompare(b.event.brigadeAbbr) ||
        (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) ||
        a.song.songTitle.localeCompare(b.song.songTitle)
      );
    });
}
