import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);
const activeQuartet = readFileSync(
  join(process.cwd(), "lib/activeQuartet.ts"),
  "utf8"
);

describe("repertoire quartet guidance", () => {
  it("stores quartet workflow history when a user starts or joins a quartet", () => {
    expect(activeQuartet).toContain("quartet-workflow-used");
    expect(activeQuartet).toContain(
      'storage.setItem(QUARTET_WORKFLOW_HISTORY_STORAGE_KEY, "true")'
    );
    expect(activeQuartet).toContain("hasQuartetWorkflowHistory");
  });

  it("shows progressive Start/Join guidance for early repertoire building", () => {
    expect(repertoireManager).toContain("showQuartetTeachingCard");
    expect(repertoireManager).toContain(
      "Good start - keep building or try a quartet"
    );
    expect(repertoireManager).toContain("Ready to try it with a quartet?");
    expect(repertoireManager).toContain("Start a quartet");
    expect(repertoireManager).toContain("Join a quartet");
    expect(repertoireManager).toContain("Add another song");
  });

  it("keeps returning-user actions non-instructional", () => {
    expect(repertoireManager).toContain("Next up");
    expect(repertoireManager).toContain("returningUserActions");
    expect(repertoireManager).toContain("!showQuartetTeachingCard");
  });

  it("uses more helpful post-save copy for early users", () => {
    expect(repertoireManager).toContain(
      "Song added. Add a few more songs for better matches, or start/join a quartet when you're ready."
    );
  });
});
