import { describe, expect, it } from "vitest";
import {
  compactVoicingDisplayLabel,
  functionalPartName,
  partAbbreviation,
  partButtonLabel,
  printedNotationSummary,
  voicingDisplayLabel,
} from "../partAbbreviations";

describe("voicing labels", () => {
  it("maps canonical voicings to user-facing arrangement labels", () => {
    expect(voicingDisplayLabel("SSAA")).toBe("Treble (SSAA)");
    expect(voicingDisplayLabel("SATB")).toBe("Mixed (SATB)");
    expect(voicingDisplayLabel("TTBB")).toBe("Lower voice (TTBB)");
  });

  it("maps canonical voicings to compact arrangement labels", () => {
    expect(compactVoicingDisplayLabel("SSAA")).toBe("Treble");
    expect(compactVoicingDisplayLabel("SATB")).toBe("Mixed");
    expect(compactVoicingDisplayLabel("TTBB")).toBe("Lower voice");
  });
});

describe("partAbbreviation", () => {
  it("uses barbershop functional abbreviations for TTBB stored parts", () => {
    expect(partAbbreviation("TTBB", "Tenor")).toBe("T");
    expect(partAbbreviation("TTBB", "Lead")).toBe("L");
    expect(partAbbreviation("TTBB", "Baritone")).toBe("Bari");
    expect(partAbbreviation("TTBB", "Bass")).toBe("Bass");
  });

  it("uses barbershop functional abbreviations for SATB stored parts", () => {
    expect(partAbbreviation("SATB", "Soprano")).toBe("T");
    expect(partAbbreviation("SATB", "Alto")).toBe("L");
    expect(partAbbreviation("SATB", "Tenor")).toBe("Bari");
    expect(partAbbreviation("SATB", "Bass")).toBe("Bass");
  });

  it("uses barbershop functional abbreviations for SSAA stored parts", () => {
    expect(partAbbreviation("SSAA", "Soprano 1")).toBe("T");
    expect(partAbbreviation("SSAA", "Soprano 2")).toBe("L");
    expect(partAbbreviation("SSAA", "Alto 1")).toBe("Bari");
    expect(partAbbreviation("SSAA", "Alto 2")).toBe("Bass");
  });

  it("uses functional part names in button labels", () => {
    expect(partButtonLabel("TTBB", "Lead")).toBe("L Lead");
    expect(partButtonLabel("TTBB", "Bass")).toBe("Bass");
    expect(partButtonLabel("SSAA", "Alto 2")).toBe("Bass");
    expect(partButtonLabel("SATB", "Tenor")).toBe("Bari Baritone");
  });

  it("keeps printed notation available as helper context", () => {
    expect(functionalPartName("SSAA", "Soprano 1")).toBe("Tenor");
    expect(functionalPartName("SSAA", "Soprano 2")).toBe("Lead");
    expect(functionalPartName("SSAA", "Alto 1")).toBe("Baritone");
    expect(functionalPartName("SSAA", "Alto 2")).toBe("Bass");
    expect(functionalPartName("SATB", "Soprano")).toBe("Tenor");
    expect(functionalPartName("SATB", "Alto")).toBe("Lead");
    expect(functionalPartName("SATB", "Tenor")).toBe("Baritone");
    expect(functionalPartName("SATB", "Bass")).toBe("Bass");
    expect(printedNotationSummary("SSAA")).toBe(
      "S1 = T, S2 = L, A1 = Bari, A2 = Bass"
    );
    expect(printedNotationSummary("SATB")).toContain("Tenor = Bari");
    expect(printedNotationSummary("TTBB")).toContain("T2 = L");
  });
});
