import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsProperties } from "../analytics";

describe("sanitizeAnalyticsProperties", () => {
  it("keeps safe primitive analytics properties", () => {
    expect(
      sanitizeAnalyticsProperties({
        session_id: "session-123",
        participant_count: 4,
        ready_match_count: 2,
        empty_value: null,
      })
    ).toEqual({
      session_id: "session-123",
      participant_count: 4,
      ready_match_count: 2,
      empty_value: null,
    });
  });

  it("drops free-text and identifying property keys", () => {
    expect(
      sanitizeAnalyticsProperties({
        song_title: "Hello, Mary Lou!",
        arranger_name: "Arranger",
        feedback_text: "Please add this",
        display_name: "Singer",
        notes: "Private note",
        email: "singer@example.com",
        song_count: 12,
      })
    ).toEqual({
      song_count: 12,
    });
  });
});
