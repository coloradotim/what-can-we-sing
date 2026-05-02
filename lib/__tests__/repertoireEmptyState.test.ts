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
    expect(repertoireManager).toContain("Add a song to My Songs");
    expect(repertoireManager).toContain("Start typing a song title...");
    expect(repertoireManager).toContain("Add song");
    expect(repertoireManager).not.toContain(
      "w-full rounded-xl bg-white/10 px-5 py-3 font-semibold"
    );
  });

  it("uses the primary typeahead to open the add flow from suggestions or manual text", () => {
    expect(repertoireManager).toContain("searchRepertoireSongSuggestions");
    expect(repertoireManager).toContain("selectSongSuggestionAndOpen");
    expect(repertoireManager).toContain("openAddModalWithCurrentTitle");
    expect(repertoireManager).toContain(
      'Add &quot;{songTitle.trim()}&quot; manually'
    );
  });

  it("keeps saved-song filters separate from adding songs", () => {
    expect(repertoireManager).toContain("hasSavedSongs &&");
    expect(repertoireManager).toContain("Search My Songs");
    expect(repertoireManager).toContain("Filter songs you've already added");
    expect(repertoireManager).toContain("aria-expanded={areFiltersOpen}");
    expect(repertoireManager).toContain("Hide filters");
    expect(repertoireManager).toContain("All voicings");
    expect(repertoireManager).toContain("All parts");
    expect(repertoireManager).toContain("Sung");
    expect(repertoireManager).toContain("Not marked sung");
    expect(repertoireManager).toContain("Mark sung today");
    expect(repertoireManager).toContain('hasSmallRepertoire ? "opacity-75"');
    expect(repertoireManager).not.toContain("Search by title");
    expect(repertoireManager).not.toContain("All arrangements");
  });

  it("keeps search primary and hides secondary filters behind a disclosure", () => {
    expect(repertoireManager).toContain(
      "lg:grid-cols-[minmax(18rem,1fr)_minmax(10rem,13rem)_auto]"
    );
    expect(repertoireManager).toContain(
      "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
    );
    expect(repertoireManager).toContain("text-base text-white");
    expect(repertoireManager).toContain(
      "Last sung appears after you mark a song as sung."
    );
    expect(repertoireManager).not.toContain(
      "Use Sung status to find songs you have or have not marked"
    );
  });

  it("uses full voicing labels on saved-song cards", () => {
    expect(repertoireManager).toContain("voicingDisplayLabel(item.voicing)");
    expect(repertoireManager).not.toContain(
      "compactVoicingDisplayLabel(item.voicing)"
    );
  });
});
