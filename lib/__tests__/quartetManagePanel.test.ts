import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const joinPage = readFileSync(
  join(process.cwd(), "app/join/[code]/page.tsx"),
  "utf8"
);

describe("quartet manage panel markup", () => {
  it("keeps the full-quartet status compact with manage actions and members", () => {
    expect(joinPage).toContain("Singing as");
    expect(joinPage).toContain("Manage");
    expect(joinPage).toContain("Members");
    expect(joinPage).toContain("Edit My Songs");
    expect(joinPage).toContain("Leave Quartet");
    expect(joinPage).toContain("showCurrentParticipantActions: false");
    expect(joinPage).not.toContain("Quartet full");
    expect(joinPage).not.toContain("Quartet is full");
    expect(joinPage).not.toContain("Quartet members");
    expect(joinPage).not.toContain("Change my display name");
  });
});
