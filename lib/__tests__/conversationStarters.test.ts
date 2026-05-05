import { describe, expect, it } from "vitest";
import {
  conversationStartersIntro,
  shouldShowConversationStarters,
} from "../conversationStarters";

describe("conversation starter visibility", () => {
  it("shows conversation starters for fewer than three ready matches", () => {
    expect(shouldShowConversationStarters(0)).toBe(true);
    expect(shouldShowConversationStarters(1)).toBe(true);
    expect(shouldShowConversationStarters(2)).toBe(true);
  });

  it("hides conversation starters when ready matches are plentiful", () => {
    expect(shouldShowConversationStarters(3)).toBe(false);
    expect(shouldShowConversationStarters(4)).toBe(false);
  });

  it("uses state-specific intro copy", () => {
    expect(conversationStartersIntro(0)).toContain("No ready matches yet");
    expect(conversationStartersIntro(2)).toContain("Only a few ready matches");
  });
});
