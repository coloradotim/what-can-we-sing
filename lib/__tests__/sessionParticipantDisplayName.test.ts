import { describe, expect, it } from "vitest";
import {
  getCurrentParticipantDisplayName,
  getParticipantDisplayName,
  getParticipantEntriesWithProfileNames,
} from "../sessionParticipantDisplayName";
import type { DbParticipant } from "../sessionStore";

function participant(): DbParticipant {
  return {
    id: "participant-1",
    session_id: "session-1",
    user_id: "user-1",
    display_name: "Old Name",
    joined_at: "2026-04-27T00:00:00Z",
    repertoire: [
      {
        userId: "user-1",
        displayName: "Old Name",
        songTitle: "Test Song",
        voicing: "TTBB",
        partsKnown: ["Lead"],
        confidence: "Good to Go",
      },
      {
        userId: "user-1",
        displayName: "Old Name",
        songTitle: "Another Song",
        voicing: "SATB",
        partsKnown: ["Tenor"],
        confidence: "A Little Rusty",
      },
    ],
  };
}

describe("session participant display name sync", () => {
  it("uses the profile name for participant display", () => {
    expect(
      getParticipantDisplayName(participant(), { "user-1": "Profile Name" })
    ).toBe("Profile Name");
  });

  it("does not fall back to stale session participant display_name", () => {
    expect(getParticipantDisplayName(participant(), {})).toBe("Singer");
  });

  it("uses the profile name for the current participant", () => {
    expect(
      getCurrentParticipantDisplayName(
        [participant()],
        "user-1",
        { "user-1": "Profile Name" },
        "Loaded Profile"
      )
    ).toBe("Profile Name");
  });

  it("uses the loaded profile fallback for the current participant while names load", () => {
    expect(
      getCurrentParticipantDisplayName(
        [participant()],
        "user-1",
        {},
        "Loaded Profile"
      )
    ).toBe("Loaded Profile");
  });

  it("falls back to profile state when the current participant is not loaded", () => {
    expect(
      getCurrentParticipantDisplayName([], "user-1", {}, "Loaded Profile")
    ).toBe("Loaded Profile");
  });

  it("uses profile names for match entries instead of snapshot names", () => {
    const entries = getParticipantEntriesWithProfileNames(
      [participant()],
      { "user-1": "Profile Name" }
    );

    expect(entries.map((entry) => entry.displayName)).toEqual([
      "Profile Name",
      "Profile Name",
    ]);
    expect(entries[0]).toMatchObject({
      userId: "user-1",
      songTitle: "Test Song",
      voicing: "TTBB",
      partsKnown: ["Lead"],
      confidence: "Good to Go",
    });
  });
});
