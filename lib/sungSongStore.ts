import { supabase } from "@/lib/supabase";
import type { Voicing } from "@/lib/matching";
import { getCurrentUser } from "@/lib/profileStore";

export type SungSongEvent = {
  id: string;
  user_id: string;
  session_id: string;
  song_title: string;
  voicing: Voicing;
  arranger_name: string | null;
  sung_at: string;
};

type RawSungSongEvent = Omit<SungSongEvent, "voicing"> & {
  voicing: string;
};

export async function getRecentSungSongs(days = 30) {
  const user = await getCurrentUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("sung_song_events")
    .select("*")
    .eq("user_id", user.id)
    .gte("sung_at", since.toISOString())
    .order("sung_at", { ascending: false });

  if (error) throw error;
  return data as RawSungSongEvent[] as SungSongEvent[];
}

export async function markSongAsSung(input: {
  sessionId: string;
  songTitle: string;
  voicing: Voicing;
  arrangerName?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in.");

  const { data, error } = await supabase
    .from("sung_song_events")
    .insert({
      user_id: user.id,
      session_id: input.sessionId,
      song_title: input.songTitle,
      voicing: input.voicing,
      arranger_name: input.arrangerName || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RawSungSongEvent as SungSongEvent;
}
