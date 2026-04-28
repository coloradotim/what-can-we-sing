import type { DbParticipant } from "@/lib/sessionStore";

export function didCurrentParticipantGetRemoved(
  previousParticipants: DbParticipant[],
  nextParticipants: DbParticipant[],
  currentUserId: string
) {
  if (!currentUserId) return false;

  const wasParticipant = previousParticipants.some(
    (participant) => participant.user_id === currentUserId
  );
  const isParticipant = nextParticipants.some(
    (participant) => participant.user_id === currentUserId
  );

  return wasParticipant && !isParticipant;
}
