import type { DbParticipant } from "./sessionStore";

export type ParticipantResolution =
  | { status: "existing"; participant: DbParticipant }
  | { status: "full" }
  | { status: "can_join" };

export function findParticipantByUserId(
  participants: DbParticipant[],
  userId: string
) {
  return participants.find((participant) => participant.user_id === userId);
}

export function resolveParticipantForJoin(
  participants: DbParticipant[],
  userId: string,
  maxParticipants: number
): ParticipantResolution {
  const existingParticipant = findParticipantByUserId(participants, userId);

  if (existingParticipant) {
    return { status: "existing", participant: existingParticipant };
  }

  if (participants.length >= maxParticipants) {
    return { status: "full" };
  }

  return { status: "can_join" };
}
