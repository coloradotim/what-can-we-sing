import { supabase } from "@/lib/supabase";
import type { SingerEntry } from "@/lib/matching";
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

export class SessionParticipantWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionParticipantWriteError";
  }
}

export class QuartetFullError extends Error {
  constructor(message = "This quartet is already full.") {
    super(message);
    this.name = "QuartetFullError";
  }
}

function isQuartetFullError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return /quartet is already full/i.test(message);
}

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
  const { data, error } = await supabase.rpc("join_session_participant", {
    p_session_id: sessionId,
    p_display_name: displayName,
    p_repertoire: repertoire,
    p_last_activity_at: lastActivityAt,
    p_max_participants: 4,
  });

  if (error) {
    if (isQuartetFullError(error)) throw new QuartetFullError();
    throw error;
  }

  const participant = Array.isArray(data) ? data[0] : data;

  if (
    !participant ||
    participant.session_id !== sessionId ||
    participant.user_id !== userId
  ) {
    throw new SessionParticipantWriteError(
      "Could not verify the quartet participant snapshot was saved."
    );
  }

  return participant as DbParticipant;
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

async function getParticipantForDelete({
  sessionId,
  userId,
  participantId,
}: {
  sessionId: string;
  userId?: string;
  participantId?: string;
}) {
  let query = supabase
    .from("session_participants")
    .select("id, session_id, user_id")
    .eq("session_id", sessionId);

  if (userId) query = query.eq("user_id", userId);
  if (participantId) query = query.eq("id", participantId);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data as Pick<DbParticipant, "id" | "session_id" | "user_id"> | null;
}

async function verifyParticipantDeleted({
  sessionId,
  userId,
  participantId,
}: {
  sessionId: string;
  userId?: string;
  participantId?: string;
}) {
  const remainingParticipant = await getParticipantForDelete({
    sessionId,
    userId,
    participantId,
  });

  if (remainingParticipant) {
    throw new SessionParticipantWriteError(
      "Could not verify that the quartet participant row was deleted."
    );
  }
}

export async function removeParticipant(sessionId: string, userId: string) {
  const participant = await getParticipantForDelete({ sessionId, userId });

  if (!participant) {
    throw new SessionParticipantWriteError(
      "Could not find your quartet participant row to delete."
    );
  }

  const { error } = await supabase
    .from("session_participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  if (error) throw error;
  await verifyParticipantDeleted({ sessionId, userId });

  return participant;
}

export async function removeParticipantById(
  sessionId: string,
  participantId: string
) {
  const { data, error } = await supabase.rpc(
    "remove_session_participant_by_id",
    {
      p_session_id: sessionId,
      p_participant_id: participantId,
    }
  );

  if (error) throw error;
  const participant = Array.isArray(data) ? data[0] : data;

  if (
    !participant ||
    participant.session_id !== sessionId ||
    participant.id !== participantId
  ) {
    throw new SessionParticipantWriteError(
      "Could not verify that the selected quartet participant row was deleted."
    );
  }

  await verifyParticipantDeleted({ sessionId, participantId });

  return participant as Pick<DbParticipant, "id" | "session_id" | "user_id">;
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
        event: "INSERT",
        schema: "public",
        table: "session_participants",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onChange(payload as ParticipantChangePayload);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "session_participants",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onChange(payload as ParticipantChangePayload);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "session_participants",
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
