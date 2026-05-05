import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const joinPage = readFileSync(
  join(process.cwd(), "app/join/[code]/page.tsx"),
  "utf8"
);

describe("quartet manage panel markup", () => {
  it("puts Manage in the header and current-user actions in the member card", () => {
    expect(joinPage).toContain("Manage");
    expect(joinPage).toContain('aria-controls="quartet-manage-panel"');
    expect(joinPage).toContain("People in this quartet");
    expect(joinPage).toContain("orderedParticipants.map");
    expect(joinPage).toContain("Edit My Songs");
    expect(joinPage).toContain("Leave quartet");
    expect(joinPage).not.toContain("Singing as");
    expect(joinPage).not.toContain("Edit Repertoire");
    expect(joinPage).not.toContain("Quartet full");
    expect(joinPage).not.toContain("Quartet is full");
    expect(joinPage).not.toContain("Quartet members");
    expect(joinPage).not.toContain("Change my display name");
  });

  it("uses a success toast and temporary card state for mark-as-sung", () => {
    expect(joinPage).toContain("Nice — marked as sung.");
    expect(joinPage).toContain("celebratingSungKey");
    expect(joinPage).toContain("isSungCelebrating={celebratingSungKey === id}");
    expect(joinPage).toContain("Could not mark that song as sung.");
  });

  it("renders encouraging full-quartet no-match guidance and conversation starters", () => {
    expect(joinPage).toContain("No quartet-ready matches yet");
    expect(joinPage).toContain(
      "all required parts are covered by different"
    );
    expect(joinPage).toContain("Conversation starters");
    expect(joinPage).toContain("conversationStartersIntro");
    expect(joinPage).toContain("showConversationStartersSection");
    expect(joinPage).toContain("Ask if anyone knows another part");
    expect(joinPage).toContain("Review My Songs");
    expect(joinPage).not.toContain("Refresh matches");
  });

  it("keeps full-quartet failed joiners out of active results", () => {
    expect(joinPage).toContain("quartetFullMessage");
    expect(joinPage).toContain("shouldShowQuartetResults");
    expect(joinPage).toContain("A quartet can have up to four singers.");
  });
});
