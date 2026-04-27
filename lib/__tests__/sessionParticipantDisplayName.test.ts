import { describe, expect, it } from "vitest";
import { applyParticipantDisplayName } from "../sessionParticipantDisplayName";
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
  it("updates both the participant row name and repertoire snapshot names", () => {
    const result = applyParticipantDisplayName(participant(), "New Name");

    expect(result.display_name).toBe("New Name");
    expect(result.repertoire.map((entry) => entry.displayName)).toEqual([
      "New Name",
      "New Name",
    ]);
  });

  it("does not change participant identity or repertoire song details", () => {
    const original = participant();
    const result = applyParticipantDisplayName(original, "New Name");

    expect(result.id).toBe("participant-1");
    expect(result.session_id).toBe("session-1");
    expect(result.user_id).toBe("user-1");
    expect(result.repertoire[0]).toMatchObject({
      userId: "user-1",
      songTitle: "Test Song",
      voicing: "TTBB",
      partsKnown: ["Lead"],
      confidence: "Good to Go",
    });
  });
});
