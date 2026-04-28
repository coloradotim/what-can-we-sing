import { describe, expect, it } from "vitest";
import type { DbParticipant } from "../sessionStore";
import { didCurrentParticipantGetRemoved } from "../sessionParticipantRemoval";

function participant(id: string, userId: string): DbParticipant {
  return {
    id,
    session_id: "session-1",
    user_id: userId,
    display_name: userId,
    repertoire: [],
    joined_at: "2026-04-28T00:00:00.000Z",
  };
}

describe("didCurrentParticipantGetRemoved", () => {
  it("detects when the current user's participant row disappears", () => {
    expect(
      didCurrentParticipantGetRemoved(
        [participant("1", "current"), participant("2", "other")],
        [participant("2", "other")],
        "current"
      )
    ).toBe(true);
  });

  it("does not fire before the current user has joined", () => {
    expect(
      didCurrentParticipantGetRemoved(
        [participant("2", "other")],
        [participant("2", "other")],
        "current"
      )
    ).toBe(false);
  });

  it("does not fire while the current user remains in the quartet", () => {
    expect(
      didCurrentParticipantGetRemoved(
        [participant("1", "current")],
        [participant("1", "current"), participant("2", "other")],
        "current"
      )
    ).toBe(false);
  });
});
