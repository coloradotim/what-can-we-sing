import { describe, expect, it } from "vitest";
import { applyParticipantChange } from "../sessionParticipantChanges";
import type { DbParticipant } from "../sessionStore";

function participant(
  id: string,
  sessionId: string,
  joinedAt: string,
  displayName = id
): DbParticipant {
  return {
    id,
    session_id: sessionId,
    user_id: `user-${id}`,
    display_name: displayName,
    repertoire: [],
    joined_at: joinedAt,
  };
}

describe("applyParticipantChange", () => {
  it("adds inserted participants for the current session", () => {
    const existing = participant("one", "session-1", "2026-01-01T00:00:00Z");
    const inserted = participant("two", "session-1", "2026-01-01T00:01:00Z");

    const result = applyParticipantChange(
      [existing],
      {
        eventType: "INSERT",
        new: inserted,
        old: {},
      },
      "session-1"
    );

    expect(result.map((item) => item.id)).toEqual(["one", "two"]);
  });

  it("updates existing participants without duplicating them", () => {
    const existing = participant("one", "session-1", "2026-01-01T00:00:00Z");
    const updated = participant(
      "one",
      "session-1",
      "2026-01-01T00:00:00Z",
      "Updated Singer"
    );

    const result = applyParticipantChange(
      [existing],
      {
        eventType: "UPDATE",
        new: updated,
        old: existing,
      },
      "session-1"
    );

    expect(result).toHaveLength(1);
    expect(result[0].display_name).toBe("Updated Singer");
  });

  it("removes deleted participants for the current session", () => {
    const first = participant("one", "session-1", "2026-01-01T00:00:00Z");
    const second = participant("two", "session-1", "2026-01-01T00:01:00Z");

    const result = applyParticipantChange(
      [first, second],
      {
        eventType: "DELETE",
        new: {},
        old: { id: "one", session_id: "session-1" },
      },
      "session-1"
    );

    expect(result.map((item) => item.id)).toEqual(["two"]);
  });

  it("ignores changes from other sessions", () => {
    const existing = participant("one", "session-1", "2026-01-01T00:00:00Z");
    const otherSession = participant(
      "two",
      "session-2",
      "2026-01-01T00:01:00Z"
    );

    const result = applyParticipantChange(
      [existing],
      {
        eventType: "INSERT",
        new: otherSession,
        old: {},
      },
      "session-1"
    );

    expect(result).toEqual([existing]);
  });
});
