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
        nextDisplayName: "  New Name  ",
      })
    ).toMatchObject({ displayName: "New Name" });
  });

  it("does not sync when there is no active quartet", () => {
    expect(
      getActiveQuartetDisplayNameSync({
        activeQuartet: null,
        userId: "user-1",
        nextDisplayName: "New Name",
      })
    ).toBeNull();
  });

  it("still syncs when the profile display name did not change", () => {
    expect(
      getActiveQuartetDisplayNameSync({
        activeQuartet,
        userId: "user-1",
        nextDisplayName: "Tim - new name",
      })
    ).toEqual({
      sessionId: "session-1",
      userId: "user-1",
      displayName: "Tim - new name",
    });
  });

  it("does not sync blank display names", () => {
    expect(
      getActiveQuartetDisplayNameSync({
        activeQuartet,
        userId: "user-1",
        nextDisplayName: "   ",
      })
    ).toBeNull();
  });
});
