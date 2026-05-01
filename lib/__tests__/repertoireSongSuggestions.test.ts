import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repertoireManager = readFileSync(
  join(process.cwd(), "components/RepertoireManager.tsx"),
  "utf8"
);

describe("repertoire song suggestion UI", () => {
  it("keeps catalog suggestions optional and limited", () => {
    expect(repertoireManager).toContain(
      "Start typing to see suggestions, or enter your own song"
    );
    expect(repertoireManager).toContain("Song suggestions are optional");
    expect(repertoireManager).toContain("Don&apos;t see your version?");
    expect(repertoireManager).toContain(
      "Add &quot;{songTitle.trim()}&quot; as your own song"
    );
    expect(repertoireManager).toContain(
      "Choose the voicing, arranger, part, and confidence"
    );
    expect(repertoireManager).not.toContain("Add manually");
    expect(repertoireManager).toContain("max-h-80 overflow-y-auto");
    expect(repertoireManager).toContain("setTimeout(async () =>");
    expect(repertoireManager).toContain("}, 250)");
    expect(repertoireManager).toContain("songSuggestionSubtitle");
  });

  it("requires choosing a voicing after selecting a grouped suggestion", () => {
    expect(repertoireManager).toContain(
      "const voicingOptions = suggestedVoicings ?? voicings"
    );
    expect(repertoireManager).toContain(
      'suggestion.voicings.length === 1 ? (suggestion.voicings[0] ?? "") :'
    );
    expect(repertoireManager).toContain("voicingOptions.map((v) =>");
  });

  it("closes suggestions into a selected-song summary", () => {
    expect(repertoireManager).toContain('setAddSongSource("suggestion")');
    expect(repertoireManager).toContain('setAddSongSource("own-title")');
    expect(repertoireManager).toContain("const selectedSongSummaryOpen");
    expect(repertoireManager).toContain("Selected song");
    expect(repertoireManager).toContain("Adding your own song title");
    expect(repertoireManager).toContain(
      "Next: choose the part you sing and your confidence."
    );
  });
});
