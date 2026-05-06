import { describe, expect, it } from "vitest";
import { formatEventModeMessageNotificationEmail } from "@/lib/eventModeNotificationEmail";

describe("Event Mode notification email", () => {
  it("points recipients back to the app without including message content or contact info", () => {
    const text = formatEventModeMessageNotificationEmail({
      eventName: "RMD Fall Convention",
      senderDisplayName: "Tim Singer",
      eventUrl: "https://www.whatcanwesing.com/event-mode/ABC123",
    });

    expect(text).toContain("Tim Singer sent you a message");
    expect(text).toContain("RMD Fall Convention");
    expect(text).toContain("https://www.whatcanwesing.com/event-mode/ABC123");
    expect(text).toContain("does not include the message text");
    expect(text).toContain("sender email address");
    expect(text).toContain("sender phone number");
    expect(text).not.toContain("Meet me in the lobby");
    expect(text).not.toContain("@example.com");
  });
});
