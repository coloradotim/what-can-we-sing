import { supabase } from "@/lib/supabase";
import type { SingerEntry } from "@/lib/matching";

export type DbSession = {
  id: string;
  join_code: string;
  created_at: string;
};

export type DbParticipant = {
  id: string;
  session_id: string;
  display_name: string;
  repertoire: SingerEntry[];
  joined_at: string;
};

export async function createSession(joinCode: string) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ join_code: joinCode })
    .select()
    .single();

  if (error) throw error;
  return data as DbSession;
}

export async function getSessionByCode(joinCode: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("join_code", joinCode)
    .single();

  if (error) throw error;
  return data as DbSession;
}

export async function addParticipant(
  sessionId: string,
  displayName: string,
  repertoire: SingerEntry[]
) {
  const { data, error } = await supabase
    .from("session_participants")
    .insert({
      session_id: sessionId,
      display_name: displayName,
      repertoire,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DbParticipant;
}

export async function getParticipants(sessionId: string) {
  const { data, error } = await supabase
    .from("session_participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return data as DbParticipant[];
}

export function subscribeToSessionParticipants(
  sessionId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`session-participants-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "session_participants",
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}