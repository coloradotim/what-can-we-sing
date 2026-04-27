import { describe, expect, it } from "vitest";
import {
  clearActiveQuartet,
  clearActiveQuartetIfMatches,
  getActiveQuartet,
  setActiveQuartet,
} from "../activeQuartet";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("active quartet storage", () => {
  it("stores and reads the active quartet", () => {
    const storage = new MemoryStorage();

    setActiveQuartet(
      { sessionId: "session-1", code: "ABC123", joinedAt: "2026-04-27" },
      storage
    );

    expect(getActiveQuartet(storage)).toEqual({
      sessionId: "session-1",
      code: "ABC123",
      joinedAt: "2026-04-27",
    });
  });

  it("clears the active quartet", () => {
    const storage = new MemoryStorage();

    setActiveQuartet(
      { sessionId: "session-1", code: "ABC123", joinedAt: "2026-04-27" },
      storage
    );
    clearActiveQuartet(storage);

    expect(getActiveQuartet(storage)).toBeNull();
  });

  it("only clears a matching active quartet", () => {
    const storage = new MemoryStorage();

    setActiveQuartet(
      { sessionId: "session-1", code: "ABC123", joinedAt: "2026-04-27" },
      storage
    );
    clearActiveQuartetIfMatches("session-2", storage);

    expect(getActiveQuartet(storage)?.sessionId).toBe("session-1");

    clearActiveQuartetIfMatches("session-1", storage);

    expect(getActiveQuartet(storage)).toBeNull();
  });
});
