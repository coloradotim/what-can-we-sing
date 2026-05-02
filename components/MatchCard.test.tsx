import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MatchResult, Part, SingerEntry } from "@/lib/matching";
import { MatchCard } from "./MatchCard";

function singer(
  patch: Partial<SingerEntry> & { displayName: string; part: Part }
): SingerEntry {
  return {
    userId: patch.userId ?? patch.displayName,
    displayName: patch.displayName,
    songTitle: patch.songTitle ?? "Why Try to Change Me Now",
    voicing: patch.voicing ?? "TTBB",
    arrangerName: patch.arrangerName,
    partsKnown: [patch.part],
    confidence: patch.confidence ?? "Good to Go",
  };
}

function renderMatch(
  match: MatchResult,
  props: Partial<Parameters<typeof MatchCard>[0]> = {}
) {
  return renderToStaticMarkup(
    <MatchCard
      match={match}
      isExpanded
      onToggle={() => undefined}
      {...props}
    />
  );
}

function readyMatch(): MatchResult {
  return {
    songTitle: "Why Try to Change Me Now",
    voicing: "TTBB",
    arrangerNames: [],
    hasMissingArrangerInfo: false,
    category: "ready",
    missingParts: [],
    assignments: {},
    warnings: [],
    score: 0,
  };
}

describe("MatchCard", () => {
  it("shows arrangers with fuzzy title variant groups instead of a generic summary", () => {
    const html = renderMatch({
      songTitle: "Why Try to Change Me Now",
      voicing: "TTBB",
      arrangerNames: ["Cay Outerbridge"],
      hasMissingArrangerInfo: true,
      category: "possible",
      missingParts: [],
      assignments: {},
      warnings: [],
      score: 0,
      titleMatchType: "fuzzy",
      titleVariants: [
        {
          title: "Why Try To Change Me",
          normalizedTitle: "whytrytochangeme",
          singers: [
            {
              displayName: "Tenor Singer",
              part: "Tenor",
              confidence: "A Little Rusty",
              arrangerName: "Cay Outerbridge",
            },
          ],
        },
        {
          title: "Why Try To Change Me Now",
          normalizedTitle: "whytrytochangemenow",
          singers: [
            {
              displayName: "Lead Singer",
              part: "Lead",
              confidence: "Good to Go",
              arrangerName: null,
            },
            {
              displayName: "Bari Singer",
              part: "Baritone",
              confidence: "Good to Go",
              arrangerName: null,
            },
          ],
        },
      ],
    });

    expect(html).toContain("Potential title match");
    expect(html).toContain("Arranger: Cay Outerbridge");
    expect(html).toContain("Arranger: No arranger entered");
    expect(html).not.toContain("Cay Outerbridge, No arranger entered");
  });

  it("shows per-singer arrangers when the same displayed title has mixed arranger states", () => {
    const lead = singer({
      userId: "lead",
      displayName: "Lead Singer",
      part: "Lead",
      arrangerName: "Unknown",
    });
    const bass = singer({
      userId: "bass",
      displayName: "Bass Singer",
      part: "Bass",
      arrangerName: null,
    });

    const html = renderMatch({
      songTitle: "Shared Title",
      voicing: "TTBB",
      arrangerNames: ["Unknown"],
      hasMissingArrangerInfo: true,
      category: "ready",
      missingParts: [],
      assignments: {
        Lead: [lead],
        Bass: [bass],
      },
      warnings: [],
      score: 0,
    });

    expect(html).toContain("Lead Singer (Arranger: Unknown)");
    expect(html).toContain("Bass Singer (Arranger: No arranger entered)");
  });

  it("displays treble and mixed parts as barbershop functional parts", () => {
    const html = renderMatch({
      songTitle: "Treble Song",
      voicing: "SSAA",
      arrangerNames: [],
      hasMissingArrangerInfo: false,
      category: "one_part_missing",
      missingParts: ["Alto 2"],
      assignments: {
        "Soprano 1": [
          singer({
            displayName: "Tenor Singer",
            voicing: "SSAA",
            part: "Soprano 1",
          }),
        ],
        "Soprano 2": [
          singer({
            displayName: "Lead Singer",
            voicing: "SSAA",
            part: "Soprano 2",
          }),
        ],
        "Alto 1": [
          singer({
            displayName: "Bari Singer",
            voicing: "SSAA",
            part: "Alto 1",
          }),
        ],
      },
      warnings: [],
      score: 0,
    });

    expect(html).toContain("Treble (SSAA)");
    expect(html).toContain("Missing Bass");
    expect(html).toContain("Bari:");
    expect(html).not.toContain("Missing A2");
    expect(html).not.toContain("Soprano 1:");
  });

  it("shows a short success state and subtle music-note celebration", () => {
    const html = renderMatch(readyMatch(), {
      isSungCelebrating: true,
      onMarkAsSung: () => undefined,
    });

    expect(html).toContain("✓ Sung!");
    expect(html).toContain("♪");
    expect(html).toContain("♫");
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).toContain("motion-reduce:hidden");
    expect(html).not.toContain("Mark as sung");
  });

  it("keeps the mark-as-sung button retryable outside success or loading states", () => {
    const html = renderMatch(readyMatch(), {
      onMarkAsSung: () => undefined,
    });

    expect(html).toContain("Mark as sung");
    expect(html).not.toContain("✓ Sung!");
    expect(html).not.toContain("♪");
  });
});
