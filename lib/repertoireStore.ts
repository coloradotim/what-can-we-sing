import { supabase } from "@/lib/supabase";
import {
  normalizeConfidence,
  type Confidence,
  type Part,
  type PartConfidence,
  type Voicing,
} from "@/lib/matching";
import { getCurrentUser } from "@/lib/profileStore";
import {
  getSongSuggestions,
  type SongSuggestion,
  type SongSuggestionSource,
} from "@/lib/songSuggestions";

export type RepertoireRow = {
  id: string;
  user_id: string;
  song_title: string;
  voicing: Voicing;
  arranger_name: string | null;
  parts_known: Part[];
  part_confidences: PartConfidence[];
  confidence: Confidence;
  notes: string | null;
  last_sung_at: string | null;
  times_sung_count: number;
  created_at: string;
  updated_at: string;
};

type RawRepertoireRow = Omit<RepertoireRow, "confidence" | "part_confidences"> & {
  confidence: string | null;
  part_confidences?: unknown;
};

const validParts: Part[] = [
  "Tenor",
  "Lead",
  "Baritone",
  "Bass",
  "Soprano",
  "Alto",
  "Soprano 1",
  "Soprano 2",
  "Alto 1",
  "Alto 2",
];

function isPart(value: unknown): value is Part {
  return typeof value === "string" && validParts.includes(value as Part);
}

function normalizePartConfidences(row: RawRepertoireRow): PartConfidence[] {
  if (Array.isArray(row.part_confidences)) {
    const seen = new Set<Part>();
    const normalized = row.part_confidences
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const candidate = item as { part?: unknown; confidence?: unknown };
        const confidence =
          typeof candidate.confidence === "string"
            ? normalizeConfidence(candidate.confidence)
            : null;

        if (!isPart(candidate.part) || !confidence || seen.has(candidate.part)) {
          return null;
        }

        seen.add(candidate.part);
        return { part: candidate.part, confidence };
      })
      .filter((item): item is PartConfidence => Boolean(item));

    if (normalized.length > 0) return normalized;
  }

  const fallbackConfidence = normalizeConfidence(row.confidence) ?? "Music Required";
  return row.parts_known.map((part) => ({
    part,
    confidence: fallbackConfidence,
  }));
}

function normalizeRepertoireRow(row: RawRepertoireRow): RepertoireRow {
  const partConfidences = normalizePartConfidences(row);

  return {
    ...row,
    parts_known: partConfidences.map((item) => item.part),
    part_confidences: partConfidences,
    confidence: partConfidences[0]?.confidence ?? "Music Required",
    last_sung_at: row.last_sung_at ?? null,
    times_sung_count: row.times_sung_count ?? 0,
  };
}

export async function getMyRepertoire() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_repertoire")
    .select("*")
    .eq("user_id", user.id)
    .order("song_title", { ascending: true });

  if (error) throw error;
  return (data as RawRepertoireRow[]).map(normalizeRepertoireRow);
}

export async function searchRepertoireSongSuggestions(
  query: string,
  limit = 6
): Promise<SongSuggestion[]> {
  const { data, error } = await supabase.rpc(
    "search_repertoire_song_suggestions",
    {
      p_query: query,
      p_limit: limit,
    }
  );

  if (error) throw error;
  return getSongSuggestions(
    (data ?? []) as SongSuggestionSource[],
    query,
    limit
  );
}

export async function markRepertoireItemAsSung(id: string, sessionId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const { data, error } = await supabase.rpc("mark_repertoire_sung", {
    p_repertoire_id: id,
    p_session_id: sessionId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.user_id !== user.id || row.id !== id) {
    throw new Error("Could not verify that your repertoire row was marked as sung.");
  }

  return normalizeRepertoireRow(row as RawRepertoireRow);
}

export async function addRepertoireItem(input: {
  songTitle: string;
  voicing: Voicing;
  arrangerName?: string;
  partConfidences: PartConfidence[];
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");
  const primaryConfidence = input.partConfidences[0]?.confidence ?? "Music Required";

  const { data, error } = await supabase
    .from("user_repertoire")
    .insert({
      user_id: user.id,
      song_title: input.songTitle,
      voicing: input.voicing,
      arranger_name: input.arrangerName || null,
      parts_known: input.partConfidences.map((item) => item.part),
      part_confidences: input.partConfidences,
      confidence: primaryConfidence,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RepertoireRow;
}

export async function updateRepertoireItem(
  id: string,
  input: {
    songTitle: string;
    voicing: Voicing;
    arrangerName?: string;
    partConfidences: PartConfidence[];
    notes?: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");
  const primaryConfidence = input.partConfidences[0]?.confidence ?? "Music Required";

  const { data, error } = await supabase
    .from("user_repertoire")
    .update({
      song_title: input.songTitle,
      voicing: input.voicing,
      arranger_name: input.arrangerName || null,
      parts_known: input.partConfidences.map((item) => item.part),
      part_confidences: input.partConfidences,
      confidence: primaryConfidence,
      notes: input.notes || null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as RepertoireRow;
}

export async function deleteRepertoireItem(id: string) {
  const { error } = await supabase.from("user_repertoire").delete().eq("id", id);
  if (error) throw error;
}
