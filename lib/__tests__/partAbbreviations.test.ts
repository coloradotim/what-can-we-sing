import { describe, expect, it } from "vitest";
import { partAbbreviation, partButtonLabel } from "../partAbbreviations";

describe("partAbbreviation", () => {
  it("uses the standard TTBB abbreviations", () => {
    expect(partAbbreviation("TTBB", "Tenor")).toBe("T");
    expect(partAbbreviation("TTBB", "Lead")).toBe("L");
    expect(partAbbreviation("TTBB", "Baritone")).toBe("Bari");
    expect(partAbbreviation("TTBB", "Bass")).toBe("Bass");
  });

  it("uses the standard SATB abbreviations", () => {
    expect(partAbbreviation("SATB", "Soprano")).toBe("S");
    expect(partAbbreviation("SATB", "Alto")).toBe("A");
    expect(partAbbreviation("SATB", "Tenor")).toBe("T");
    expect(partAbbreviation("SATB", "Bass")).toBe("Bass");
  });

  it("uses the standard SSAA abbreviations", () => {
    expect(partAbbreviation("SSAA", "Soprano 1")).toBe("S1");
    expect(partAbbreviation("SSAA", "Soprano 2")).toBe("S2");
    expect(partAbbreviation("SSAA", "Alto 1")).toBe("A1");
    expect(partAbbreviation("SSAA", "Alto 2")).toBe("A2");
  });

  it("includes full part names in button labels only when abbreviated", () => {
    expect(partButtonLabel("TTBB", "Lead")).toBe("L Lead");
    expect(partButtonLabel("TTBB", "Bass")).toBe("Bass");
    expect(partButtonLabel("SSAA", "Alto 2")).toBe("A2 Alto 2");
  });
});
