import { supabase } from "@/lib/supabase";
import type { SingerEntry } from "@/lib/matching";
import { applyParticipantDisplayName } from "@/lib/sessionParticipantDisplayName";
import type { ParticipantChangePayload } from "@/lib/sessionParticipantChanges";

export type DbSession = {
  id: string;
  join_code: string;
  created_at: string;
  last_activity_at?: string | null;
};

export type DbParticipant = {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string;
  repertoire: SingerEntry[];
  joined_at: string;
};

export async function createSession(joinCode: string) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      join_code: joinCode,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as DbSession;
}

async function updateSessionActivity(sessionId: string, lastActivityAt: string) {
  const { error } = await supabase
    .from("sessions")
    .update({ last_activity_at: lastActivityAt })
    .eq("id", sessionId);

  if (error) throw error;
}

async function tryUpdateSessionActivity(
  sessionId: string,
  lastActivityAt: string
) {
  try {
    await updateSessionActivity(sessionId, lastActivityAt);
  } catch (err) {
    console.warn("Could not update session activity", err);
  }
}

export async function getSessionByCode(joinCode: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (error) throw error;
  return data as DbSession | null;
}

export async function upsertParticipant(
  sessionId: string,
  userId: string,
  displayName: string,
  repertoire: SingerEntry[],
  lastActivityAt = new Date().toISOString()
) {
  const { data, error } = await supabase
    .from("session_participants")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        display_name: displayName,
        repertoire,
      },
      { onConflict: "session_id,user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  await updateSessionActivity(sessionId, lastActivityAt);
  return data as DbParticipant;
}

export async function updateParticipantSnapshot(
  participantId: string,
  userId: string,
  displayName: string,
  repertoire: SingerEntry[],
  lastActivityAt = new Date().toISOString()
) {
  const { data, error } = await supabase
    .from("session_participants")
    .update({
      display_name: displayName,
      repertoire,
    })
    .eq("id", participantId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  await updateSessionActivity(data.session_id, lastActivityAt);
  return data as DbParticipant;
}

export async function updateParticipantDisplayName(
  sessionId: string,
  userId: string,
  displayName: string,
  lastActivityAt = new Date().toISOString()
) {
  const currentParticipants = await getParticipants(sessionId);
  const currentParticipant = currentParticipants.find(
    (participant) => participant.user_id === userId
  );

  if (!currentParticipant) {
    throw new Error("Active quartet participant was not found.");
  }

  const updatedParticipant = applyParticipantDisplayName(
    currentParticipant,
    displayName
  );

  const { data, error } = await supabase
    .from("session_participants")
    .update({
      display_name: updatedParticipant.display_name,
      repertoire: updatedParticipant.repertoire,
    })
    .eq("id", currentParticipant.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  await tryUpdateSessionActivity(sessionId, lastActivityAt);

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

export async function removeParticipant(sessionId: string, userId: string) {
  const { error } = await supabase
    .from("session_participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  if (error) throw error;
}

export function subscribeToSessionParticipants(
  sessionId: string,
  onChange: (payload: ParticipantChangePayload) => void,
  onStatusChange?: (status: string) => void
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
      (payload) => {
        onChange(payload as ParticipantChangePayload);
      }
    )
    .subscribe((status) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        onStatusChange?.(status);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
