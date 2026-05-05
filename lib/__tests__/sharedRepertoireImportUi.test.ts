import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const sharedRepertoireManager = readFileSync(
  join(repoRoot, "components/SharedRepertoireManager.tsx"),
  "utf8"
);
const repertoireSharing = readFileSync(
  join(repoRoot, "lib/repertoireSharing.ts"),
  "utf8"
);

describe("shared repertoire import UI", () => {
  it("uses clear copy-flow labels and a top My Songs exit", () => {
    expect(sharedRepertoireManager).toContain('href="/songs"');
    expect(sharedRepertoireManager).toContain("&larr; Back to My Songs");
    expect(sharedRepertoireManager).toContain(
      "Select songs I don&apos;t already have"
    );
    expect(sharedRepertoireManager).not.toContain("Select all eligible");
    expect(sharedRepertoireManager).toContain(
      "Choose the songs you want to copy into My Songs"
    );
  });

  it("keeps song cards as the import unit with per-song part and confidence", () => {
    expect(sharedRepertoireManager).toContain("songCopySelections");
    expect(sharedRepertoireManager).toContain("updateSongSelection(song.id");
    expect(sharedRepertoireManager).toContain("partsByVoicing[song.voicing]");
    expect(sharedRepertoireManager).toContain(
      "selectedSongIds.has(song.id)"
    );
    expect(sharedRepertoireManager).not.toContain("selectionsByVoicing");
    expect(sharedRepertoireManager).not.toContain("selectedVoicings");
  });

  it("requires complete per-song choices and shows selected copy count", () => {
    expect(sharedRepertoireManager).toContain("!canCopySelectedSongs");
    expect(sharedRepertoireManager).toContain(
      "Choose a part and confidence for each selected song before copying."
    );
    expect(sharedRepertoireManager).toContain(
      "`Copy ${selectedSongs.length} selected ${"
    );
    expect(sharedRepertoireManager).toContain("songId: song.id");
  });

  it("keeps duplicate and possible-arrangement context visible", () => {
    expect(sharedRepertoireManager).toContain("Already in My Songs");
    expect(sharedRepertoireManager).toContain("Possible different arrangement");
    expect(sharedRepertoireManager).toContain(
      "Check the arranger before copying."
    );
    expect(sharedRepertoireManager).toContain(
      'song.duplicateStatus === "exact"'
    );
  });
});

describe("shared repertoire import helper", () => {
  it("copies with per-song selections keyed by shared song id", () => {
    expect(repertoireSharing).toContain("SharedSongCopySelection");
    expect(repertoireSharing).toContain("selections: SharedSongCopySelection[]");
    expect(repertoireSharing).toContain("selectionsBySongId.get(song.id)");
    expect(repertoireSharing).not.toContain("selectionsByVoicing");
  });
});
