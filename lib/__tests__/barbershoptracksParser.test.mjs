import { describe, expect, it } from "vitest";

const {
  dedupeBarbershopTracksRows,
  formatBarbershopTracksPsv,
  normalizeBarbershopTracksArranger,
  normalizeBarbershopTracksTitle,
  normalizeBarbershopTracksVoicing,
  parseBarbershopTracksRenderedText,
} = await import("../../scripts/barbershoptracks-parser.mjs");

describe("BarbershopTracks parser", () => {
  it("normalizes supported BarbershopTracks voicing labels", () => {
    expect(normalizeBarbershopTracksVoicing("Mens Track")).toBe("TTBB");
    expect(normalizeBarbershopTracksVoicing("Women's Track")).toBe("SSAA");
    expect(normalizeBarbershopTracksVoicing("Ladies Track")).toBe("SSAA");
    expect(normalizeBarbershopTracksVoicing("Mixed Track")).toBe("SATB");
  });

  it("normalizes trailing title articles", () => {
    expect(normalizeBarbershopTracksTitle("Closest Thing To Crazy, The")).toBe(
      "The Closest Thing To Crazy"
    );
    expect(normalizeBarbershopTracksTitle("Winter's Tale, A")).toBe(
      "A Winter's Tale"
    );
    expect(normalizeBarbershopTracksTitle("Example Song, An")).toBe(
      "An Example Song"
    );
  });

  it("normalizes arranger separators without splitting rows", () => {
    expect(normalizeBarbershopTracksArranger("Sherwyn Heckt; Alden Parker")).toBe(
      "Sherwyn Heckt, Alden Parker"
    );
    expect(normalizeBarbershopTracksArranger("Name One & Name Two")).toBe(
      "Name One and Name Two"
    );
  });

  it("parses multiple rendered text records", () => {
    const parsed = parseBarbershopTracksRenderedText(`
      First Song
      Arranger: Arranger One
      Voicing: Mens Track
      Contestable: Yes
      Genre: Ballad
      Artist: Someone
      Learn More
      Second Song, The
      Arranger: Arranger Two
      Voicing: Mixed Track
      Learn More
    `);

    expect(parsed.skipped).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        title: "First Song",
        voicing: "TTBB",
        arranger: "Arranger One",
        source: "BarbershopTracks",
      },
      {
        title: "The Second Song",
        voicing: "SATB",
        arranger: "Arranger Two",
        source: "BarbershopTracks",
      },
    ]);
  });

  it("skips unknown voicing values instead of importing them", () => {
    const parsed = parseBarbershopTracksRenderedText(`
      Unknown Voicing Song
      Arranger: Someone
      Voicing: Octet Track
      Learn More
    `);

    expect(parsed.rows).toEqual([]);
    expect(parsed.skipped).toEqual([
      expect.objectContaining({
        title: "Unknown Voicing Song",
        voicing: "Octet Track",
        reason: "unknown_voicing",
      }),
    ]);
  });

  it("dedupes identical source rows but preserves arranger and voicing variants", () => {
    const { rows, duplicateRows } = dedupeBarbershopTracksRows([
      { title: "Same Song", voicing: "TTBB", arranger: "Writer" },
      { title: "Same Song", voicing: "TTBB", arranger: "Writer" },
      { title: "Same Song", voicing: "TTBB", arranger: "Other Writer" },
      { title: "Same Song", voicing: "SSAA", arranger: "Writer" },
    ]);

    expect(duplicateRows).toBe(1);
    expect(rows).toEqual([
      { title: "Same Song", voicing: "SSAA", arranger: "Writer" },
      { title: "Same Song", voicing: "TTBB", arranger: "Other Writer" },
      { title: "Same Song", voicing: "TTBB", arranger: "Writer" },
    ]);
  });

  it("replaces accidental pipe characters before writing PSV", () => {
    expect(
      formatBarbershopTracksPsv([
        { title: "Pipe | Song", voicing: "TTBB", arranger: "Name | Two" },
      ])
    ).toBe("Song Title|Voicing|Arranger\nPipe / Song|TTBB|Name / Two\n");
  });
});
