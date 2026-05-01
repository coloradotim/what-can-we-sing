import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("repertoire empty state", () => {
  it("makes the song-title input the primary first-run action", () => {
    expect(repertoireManager).toContain("Add your first song");
    expect(repertoireManager).toContain("Add songs here");
    expect(repertoireManager).toContain("Add a song to your repertoire");
    expect(repertoireManager).toContain("Start typing a song title...");
    expect(repertoireManager).toContain("Add manually");
  });

  it("uses the primary typeahead to open the add flow from suggestions or manual text", () => {
    expect(repertoireManager).toContain("searchRepertoireSongSuggestions");
    expect(repertoireManager).toContain("selectSongSuggestionAndOpen");
    expect(repertoireManager).toContain("openAddModalWithCurrentTitle");
    expect(repertoireManager).toContain('Add &quot;{songTitle.trim()}&quot; manually');
  });

  it("keeps saved-song filters separate from adding songs", () => {
    expect(repertoireManager).toContain("hasSavedSongs &&");
    expect(repertoireManager).toContain("Filter saved songs");
    expect(repertoireManager).toContain("Search my repertoire");
    expect(repertoireManager).toContain("Filter songs you've already added");
    expect(repertoireManager).toContain('hasSmallRepertoire ? "opacity-75"');
    expect(repertoireManager).not.toContain("Search by title");
  });
});
