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
      "Choose your own title, voicing, arranger, part, and"
    );
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
});
