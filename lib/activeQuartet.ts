const ACTIVE_QUARTET_STORAGE_KEY = "active-quartet";
export const ACTIVE_QUARTET_CHANGED_EVENT = "active-quartet-changed";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export type ActiveQuartet = {
  sessionId: string;
  code: string;
  joinedAt: string;
};

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function notifyActiveQuartetChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(ACTIVE_QUARTET_CHANGED_EVENT));
}

export function getActiveQuartet(
  storage = getBrowserStorage()
): ActiveQuartet | null {
  if (!storage) return null;

  try {
    const value = storage.getItem(ACTIVE_QUARTET_STORAGE_KEY);
    if (!value) return null;

    const activeQuartet = JSON.parse(value) as Partial<ActiveQuartet>;
    if (!activeQuartet.sessionId || !activeQuartet.code) return null;

    return {
      sessionId: activeQuartet.sessionId,
      code: activeQuartet.code,
      joinedAt: activeQuartet.joinedAt ?? "",
    };
  } catch {
    return null;
  }
}

export function setActiveQuartet(
  activeQuartet: ActiveQuartet,
  storage = getBrowserStorage()
) {
  if (!storage) return;

  storage.setItem(ACTIVE_QUARTET_STORAGE_KEY, JSON.stringify(activeQuartet));
  notifyActiveQuartetChanged();
}

export function clearActiveQuartet(storage = getBrowserStorage()) {
  if (!storage) return;

  storage.removeItem(ACTIVE_QUARTET_STORAGE_KEY);
  notifyActiveQuartetChanged();
}

export function clearActiveQuartetIfMatches(
  sessionId: string,
  storage = getBrowserStorage()
) {
  const activeQuartet = getActiveQuartet(storage);

  if (activeQuartet?.sessionId === sessionId) {
    clearActiveQuartet(storage);
  }
}

export function isDifferentActiveQuartet(
  sessionId: string,
  storage = getBrowserStorage()
): boolean {
  const activeQuartet = getActiveQuartet(storage);

  return Boolean(activeQuartet && activeQuartet.sessionId !== sessionId);
}
