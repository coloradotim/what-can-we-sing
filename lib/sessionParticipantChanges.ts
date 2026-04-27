import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { DbParticipant } from "./sessionStore";

export type ParticipantChangePayload =
  RealtimePostgresChangesPayload<DbParticipant>;

function sortParticipants(participants: DbParticipant[]) {
  return [...participants].sort(
    (a, b) =>
      new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
  );
}

export function applyParticipantChange(
  participants: DbParticipant[],
  payload: ParticipantChangePayload,
  sessionId: string
) {
  if (payload.eventType === "DELETE") {
    const deletedParticipant = payload.old;

    if (
      deletedParticipant.session_id &&
      deletedParticipant.session_id !== sessionId
    ) {
      return participants;
    }

    if (!deletedParticipant.id) return participants;

    return participants.filter(
      (participant) => participant.id !== deletedParticipant.id
    );
  }

  const changedParticipant = payload.new;

  if (
    !changedParticipant?.id ||
    changedParticipant.session_id !== sessionId
  ) {
    return participants;
  }

  return sortParticipants([
    ...participants.filter(
      (participant) => participant.id !== changedParticipant.id
    ),
    changedParticipant,
  ]);
}
