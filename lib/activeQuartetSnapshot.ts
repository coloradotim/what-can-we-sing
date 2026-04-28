import { getActiveQuartet, clearActiveQuartetIfMatches, setActiveQuartet } from "@/lib/activeQuartet";
import { type SingerEntry } from "@/lib/matching";
import { getCurrentUser, getMyProfile } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import { getParticipants, upsertParticipant } from "@/lib/sessionStore";
import { findParticipantByUserId } from "@/lib/sessionParticipantResolution";

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
  if (!profile?.display_name) return { status: "missing_profile" as const };

  const repertoire = await getMyRepertoire();
  const entries: SingerEntry[] = repertoire.map((item) => ({
    userId: item.user_id,
    displayName: profile.display_name,
    songTitle: item.song_title,
    voicing: item.voicing,
    arrangerName: item.arranger_name,
    partsKnown: item.parts_known,
    confidence: item.confidence,
  }));
  const lastActivityAt = new Date().toISOString();

  await upsertParticipant(
    activeQuartet.sessionId,
    user.id,
    profile.display_name,
    entries,
    lastActivityAt
  );
  setActiveQuartet({
    ...activeQuartet,
    joinedAt: lastActivityAt,
  });

  return { status: "updated" as const, songCount: entries.length };
}
