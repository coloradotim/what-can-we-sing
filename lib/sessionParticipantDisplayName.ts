import type { DbParticipant } from "@/lib/sessionStore";
import type { SingerEntry } from "@/lib/matching";
import type { ProfileChangePayload } from "@/lib/profileStore";

export type ProfileDisplayNamesByUserId = Record<string, string>;

const fallbackDisplayName = "Singer";

export function getParticipantDisplayName(
  participant: DbParticipant,
  profileDisplayNamesByUserId: ProfileDisplayNamesByUserId
) {
  return profileDisplayNamesByUserId[participant.user_id] ?? fallbackDisplayName;
}

export function getCurrentParticipantDisplayName(
  participants: DbParticipant[],
  userId: string,
  profileDisplayNamesByUserId: ProfileDisplayNamesByUserId,
  fallbackDisplayName: string
) {
  const currentParticipant = participants.find(
    (participant) => participant.user_id === userId
  );

  if (!currentParticipant) return fallbackDisplayName;

  return getParticipantDisplayName(
    currentParticipant,
    {
      [currentParticipant.user_id]: fallbackDisplayName,
      ...profileDisplayNamesByUserId,
    }
  );
}

export function getParticipantEntriesWithProfileNames(
  participants: DbParticipant[],
  profileDisplayNamesByUserId: ProfileDisplayNamesByUserId
): SingerEntry[] {
  return participants.flatMap((participant) => {
    const displayName = getParticipantDisplayName(
      participant,
      profileDisplayNamesByUserId
    );

    return participant.repertoire.map((entry) => ({
      ...entry,
      displayName,
    }));
  });
}

export function applyProfileDisplayNameChange(
  profileDisplayNamesByUserId: ProfileDisplayNamesByUserId,
  payload: ProfileChangePayload,
  relevantUserIds: string[]
): ProfileDisplayNamesByUserId {
  if (payload.eventType === "DELETE") {
    const deletedProfileId = payload.old.id;

    if (!deletedProfileId || !relevantUserIds.includes(deletedProfileId)) {
      return profileDisplayNamesByUserId;
    }

    const { [deletedProfileId]: _deleted, ...remainingProfiles } =
      profileDisplayNamesByUserId;
    return remainingProfiles;
  }

  const changedProfile = payload.new;

  if (
    !changedProfile?.id ||
    !relevantUserIds.includes(changedProfile.id)
  ) {
    return profileDisplayNamesByUserId;
  }

  return {
    ...profileDisplayNamesByUserId,
    [changedProfile.id]: changedProfile.display_name,
  };
}
