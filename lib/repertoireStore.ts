import { supabase } from "@/lib/supabase";
import { normalizeConfidence, type Confidence, type Part, type Voicing } from "@/lib/matching";
import { getCurrentUser } from "@/lib/profileStore";

export type RepertoireRow = {
  id: string;
  user_id: string;
  song_title: string;
  voicing: Voicing;
  arranger_name: string | null;
  parts_known: Part[];
  confidence: Confidence;
  created_at: string;
  updated_at: string;
};

type RawRepertoireRow = Omit<RepertoireRow, "confidence"> & {
  confidence: string | null;
};

function normalizeRepertoireRow(row: RawRepertoireRow): RepertoireRow {
  return {
    ...row,
    confidence: normalizeConfidence(row.confidence) ?? "Music Required",
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

export async function addRepertoireItem(input: {
  songTitle: string;
  voicing: Voicing;
  arrangerName?: string;
  partsKnown: Part[];
  confidence: Confidence;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const { data, error } = await supabase
    .from("user_repertoire")
    .insert({
      user_id: user.id,
      song_title: input.songTitle,
      voicing: input.voicing,
      arranger_name: input.arrangerName || null,
      parts_known: input.partsKnown,
      confidence: input.confidence,
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
    partsKnown: Part[];
    confidence: Confidence;
  }
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const { data, error } = await supabase
    .from("user_repertoire")
    .update({
      song_title: input.songTitle,
      voicing: input.voicing,
      arranger_name: input.arrangerName || null,
      parts_known: input.partsKnown,
      confidence: input.confidence,
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
