import type { DbParticipant } from "@/lib/sessionStore";

export function getCurrentParticipantDisplayName(
  participants: DbParticipant[],
  userId: string,
  fallbackDisplayName: string
) {
  return (
    participants.find((participant) => participant.user_id === userId)
      ?.display_name ?? fallbackDisplayName
  );
}

export function applyParticipantDisplayName(
  participant: DbParticipant,
  displayName: string
): DbParticipant {
  return {
    ...participant,
    display_name: displayName,
    repertoire: participant.repertoire.map((entry) => ({
      ...entry,
      displayName,
    })),
  };
}
