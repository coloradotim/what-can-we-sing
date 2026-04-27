import { describe, expect, it } from "vitest";
import { getActiveQuartetDisplayNameSync } from "../activeQuartetDisplayNameSync";

describe("active quartet display name sync", () => {
  const activeQuartet = {
    sessionId: "session-1",
    code: "ABC123",
    joinedAt: "2026-04-27T00:00:00Z",
  };

  it("returns a participant update keyed by session and user id", () => {
    expect(
      getActiveQuartetDisplayNameSync({
        activeQuartet,
        userId: "user-1",
        previousDisplayName: "Old Name",
        nextDisplayName: "New Name",
      })
    ).toEqual({
      sessionId: "session-1",
      userId: "user-1",
      displayName: "New Name",
    });
  });

  it("trims the saved display name before syncing", () => {
    expect(
      getActiveQuartetDisplayNameSync({
        activeQuartet,
        userId: "user-1",
        previousDisplayName: "Old Name",
        nextDisplayName: "  New Name  ",
      })
    ).toMatchObject({ displayName: "New Name" });
  });

  it("does not sync when there is no active quartet", () => {
    expect(
      getActiveQuartetDisplayNameSync({
        activeQuartet: null,
        userId: "user-1",
        previousDisplayName: "Old Name",
        nextDisplayName: "New Name",
      })
    ).toBeNull();
  });

  it("does not sync unchanged display names", () => {
    expect(
      getActiveQuartetDisplayNameSync({
        activeQuartet,
        userId: "user-1",
        previousDisplayName: "New Name",
        nextDisplayName: " New Name ",
      })
    ).toBeNull();
  });
});
