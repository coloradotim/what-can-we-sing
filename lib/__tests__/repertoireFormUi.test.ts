import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("repertoire form UI validation", () => {
  it("uses shared form validity for add and edit save buttons", () => {
    expect(repertoireManager).toContain(
      "const canAddSong = isRepertoireSongFormValid(songTitle, voicing, partRows)"
    );
    expect(repertoireManager).toContain("const canSaveEdit = editForm");
    expect(repertoireManager).toContain("!canSaveEdit");
    expect(repertoireManager).toContain("disabled={!canAddSong || isAdding}");
  });

  it("marks incomplete required controls as invalid", () => {
    expect(repertoireManager).toContain("aria-invalid={!row.part}");
    expect(repertoireManager).toContain("aria-invalid={!row.confidence}");
    expect(repertoireManager).toContain("border-rose-300/70");
  });
});
