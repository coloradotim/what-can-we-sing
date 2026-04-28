import { getActiveQuartet, clearActiveQuartetIfMatches, setActiveQuartet } from "@/lib/activeQuartet";
import { buildParticipantEntries } from "@/lib/participantEntries";
import { getCurrentUser, getMyProfile } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import { getParticipants, upsertParticipant } from "@/lib/sessionStore";
import { findParticipantByUserId } from "@/lib/sessionParticipantResolution";

export class ActiveQuartetSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActiveQuartetSnapshotError";
  }
}

export async function refreshActiveQuartetSnapshot() {
  const activeQuartet = getActiveQuartet();
  if (!activeQuartet) return { status: "no_active_quartet" as const };

  const user = await getCurrentUser();
  if (!user) return { status: "no_user" as const };

  const participants = await getParticipants(activeQuartet.sessionId);
  const currentParticipant = findParticipantByUserId(participants, user.id);

  if (!currentParticipant) {
    clearActiveQuartetIfMatches(activeQuartet.sessionId);
    return { status: "not_participant" as const };
  }

  const profile = await getMyProfile();
  if (!profile?.display_name) {
    throw new ActiveQuartetSnapshotError(
      "Could not update quartet matches because your profile is missing a display name."
    );
  }

  const repertoire = await getMyRepertoire();
  const entries = buildParticipantEntries(profile.display_name, repertoire);
  const lastActivityAt = new Date().toISOString();

  const updatedParticipant = await upsertParticipant(
    activeQuartet.sessionId,
    user.id,
    profile.display_name,
    entries,
    lastActivityAt
  );

  if (
    updatedParticipant.session_id !== activeQuartet.sessionId ||
    updatedParticipant.user_id !== user.id
  ) {
    throw new ActiveQuartetSnapshotError(
      "Could not verify that the active quartet snapshot was updated."
    );
  }

  setActiveQuartet({
    ...activeQuartet,
    joinedAt: lastActivityAt,
  });

  return {
    status: "updated" as const,
    participant: updatedParticipant,
    songCount: entries.length,
  };
}
