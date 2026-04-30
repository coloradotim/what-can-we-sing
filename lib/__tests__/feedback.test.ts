import { describe, expect, it } from "vitest";
import {
  feedbackTypes,
  formatFeedbackEmailText,
  validateFeedbackSubmission,
} from "../feedback";

describe("feedback helpers", () => {
  it("defaults the feedback form toward general feedback", () => {
    expect(feedbackTypes[0]).toBe("General feedback");
  });

  it("validates and trims feedback submissions", () => {
    expect(
      validateFeedbackSubmission({
        type: "Bug report",
        message: "  Something broke.  ",
        contactEmail: "  singer@example.com  ",
      })
    ).toEqual({
      type: "Bug report",
      message: "Something broke.",
      contactEmail: "singer@example.com",
    });
  });

  it("rejects blank messages", () => {
    expect(() =>
      validateFeedbackSubmission({
        type: "General feedback",
        message: " ",
      })
    ).toThrow("Add a message before sending feedback.");
  });

  it("formats useful app context for the feedback email", () => {
    expect(
      formatFeedbackEmailText(
        {
          type: "Feature idea",
          message: "Add a pitch pipe.",
          contactEmail: "singer@example.com",
        },
        {
          userId: "user-1",
          displayName: "Tim",
          timestamp: "2026-04-27T00:00:00.000Z",
        }
      )
    ).toContain("Display name: Tim");
  });
});
