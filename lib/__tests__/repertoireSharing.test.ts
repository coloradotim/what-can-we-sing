import { describe, expect, it } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

const {
  normalizeSharedSongText,
  repertoireCopyRequestMessage,
  resolveSharedSongCopyability,
  sharedRepertoirePathFromInput,
  sharedSongExactKey,
} = await import("@/lib/repertoireSharing");

import type { SharedRepertoireSong } from "@/lib/repertoireSharing";
import type { RepertoireRow } from "@/lib/repertoireStore";

function repertoireRow(
  song_title: string,
  voicing: RepertoireRow["voicing"],
  arranger_name: string | null
) {
  return {
    song_title,
    voicing,
    arranger_name,
  } as RepertoireRow;
}

const sharedSong = (
  songTitle: string,
  voicing: SharedRepertoireSong["voicing"],
  arrangerName: string | null
): SharedRepertoireSong => ({
  id: `${songTitle}-${voicing}-${arrangerName ?? "blank"}`,
  songTitle,
  voicing,
  arrangerName,
});

describe("repertoire sharing", () => {
  it("normalizes title and arranger text for duplicate detection", () => {
    expect(normalizeSharedSongText(" Why Try To Change Me Now? ")).toBe(
      "why try to change me now"
    );
    expect(sharedSongExactKey(sharedSong("Mam'selle", "TTBB", "Lou Perry"))).toBe(
      "mam selle|TTBB|lou perry"
    );
  });

  it("keeps blank arranger distinct from literal Unknown", () => {
    const blankArranger = sharedSongExactKey(
      sharedSong("Hello, My Baby", "TTBB", null)
    );
    const unknownArranger = sharedSongExactKey(
      sharedSong("Hello, My Baby", "TTBB", "Unknown")
    );

    expect(blankArranger).not.toBe(unknownArranger);
  });

  it("marks exact duplicates as already in repertoire", () => {
    const songs = [
      sharedSong("Hello, My Baby", "TTBB", "Joe Liles"),
      sharedSong("Over the Rainbow", "SATB", "Melody Hine"),
    ];

    const resolved = resolveSharedSongCopyability(songs, [
      repertoireRow("Hello My Baby", "TTBB", "Joe Liles"),
    ]);

    expect(resolved.map((song) => song.duplicateStatus)).toEqual([
      "exact",
      "eligible",
    ]);
  });

  it("allows same title and voicing with a different arranger but flags it", () => {
    const resolved = resolveSharedSongCopyability(
      [sharedSong("Coney Island Baby", "TTBB", null)],
      [repertoireRow("Coney Island Baby", "TTBB", "Unknown")]
    );

    expect(resolved[0].duplicateStatus).toBe("possible_arrangement");
  });

  it("does not compare across different voicings", () => {
    const resolved = resolveSharedSongCopyability(
      [sharedSong("Amazing Grace", "SSAA", "Tom Gentry")],
      [repertoireRow("Amazing Grace", "TTBB", "Tom Gentry")]
    );

    expect(resolved[0].duplicateStatus).toBe("eligible");
  });

  it("opens shared repertoire links from pasted codes or URLs", () => {
    expect(sharedRepertoirePathFromInput("abc123")).toBe(
      "/shared-repertoire/ABC123"
    );
    expect(
      sharedRepertoirePathFromInput(
        "https://www.whatcanwesing.com/shared-repertoire/def456"
      )
    ).toBe("/shared-repertoire/DEF456");
    expect(
      sharedRepertoirePathFromInput(
        "https://www.whatcanwesing.com/shared-repertoire/GHI789?from=text"
      )
    ).toBe("/shared-repertoire/GHI789");
    expect(sharedRepertoirePathFromInput("not a code")).toBeNull();
  });

  it("uses a clear remote request message for copy links and codes", () => {
    expect(repertoireCopyRequestMessage).toContain(
      "Let another singer copy songs from My Songs"
    );
    expect(repertoireCopyRequestMessage).toContain("link or code");
    expect(repertoireCopyRequestMessage).toContain(
      "copy a few songs into My Songs"
    );
  });
});
