import { describe, expect, it } from "vitest";
import {
  findParticipantByUserId,
  resolveParticipantForJoin,
} from "../sessionParticipantResolution";
import type { DbParticipant } from "../sessionStore";

function participant(
  id: string,
  userId: string,
  displayName: string
): DbParticipant {
  return {
    id,
    session_id: "session-1",
    user_id: userId,
    display_name: displayName,
    repertoire: [],
    joined_at: "2026-01-01T00:00:00Z",
  };
}

describe("session participant resolution", () => {
  it("finds an existing participant by user_id", () => {
    const existingParticipant = participant("participant-1", "user-1", "Tim");

    expect(
      findParticipantByUserId([existingParticipant], "user-1")
    ).toBe(existingParticipant);
  });

  it("recognizes the same participant after display_name changes", () => {
    const existingParticipant = participant(
      "participant-1",
      "user-1",
      "New Name"
    );

    const result = resolveParticipantForJoin(
      [existingParticipant],
      "user-1",
      4
    );

    expect(result).toEqual({
      status: "existing",
      participant: existingParticipant,
    });
  });

  it("does not treat an existing user as a new participant when full", () => {
    const existingParticipant = participant(
      "participant-1",
      "user-1",
      "New Name"
    );
    const participants = [
      existingParticipant,
      participant("participant-2", "user-2", "Singer 2"),
      participant("participant-3", "user-3", "Singer 3"),
      participant("participant-4", "user-4", "Singer 4"),
    ];

    expect(resolveParticipantForJoin(participants, "user-1", 4)).toEqual({
      status: "existing",
      participant: existingParticipant,
    });
  });
});
