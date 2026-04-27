import type { ActiveQuartet } from "@/lib/activeQuartet";

type ActiveQuartetDisplayNameSyncInput = {
  activeQuartet: ActiveQuartet | null;
  userId: string;
  nextDisplayName: string;
};

export type ActiveQuartetDisplayNameSync = {
  sessionId: string;
  userId: string;
  displayName: string;
};

export function getActiveQuartetDisplayNameSync({
  activeQuartet,
  userId,
  nextDisplayName,
}: ActiveQuartetDisplayNameSyncInput): ActiveQuartetDisplayNameSync | null {
  const displayName = nextDisplayName.trim();

  if (!activeQuartet || !userId || !displayName) {
    return null;
  }

  return {
    sessionId: activeQuartet.sessionId,
    userId,
    displayName,
  };
}
