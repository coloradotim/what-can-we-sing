import type { DbParticipant } from "@/lib/sessionStore";

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
