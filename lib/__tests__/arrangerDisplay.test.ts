import { describe, expect, it } from "vitest";
import {
  areLikelySameArranger,
  arrangerDisplayName,
  hasArrangerEntered,
  normalizeArrangerName,
} from "../arrangerDisplay";

describe("arranger display helpers", () => {
  it("labels blank arranger values as not entered", () => {
    expect(arrangerDisplayName(null)).toBe("No arranger entered");
    expect(arrangerDisplayName("")).toBe("No arranger entered");
    expect(arrangerDisplayName("   ")).toBe("No arranger entered");
    expect(hasArrangerEntered(null)).toBe(false);
    expect(hasArrangerEntered("   ")).toBe(false);
  });

  it("preserves literal Unknown as an entered arranger value", () => {
    expect(arrangerDisplayName("Unknown")).toBe("Unknown");
    expect(hasArrangerEntered("Unknown")).toBe(true);
  });

  it("trims entered arranger names for display", () => {
    expect(arrangerDisplayName("  Joe Arranger  ")).toBe("Joe Arranger");
    expect(hasArrangerEntered("  Joe Arranger  ")).toBe(true);
  });

  it("normalizes capitalization, punctuation, and spacing", () => {
    expect(normalizeArrangerName("  C.   Outerbridge ")).toBe("c outerbridge");
  });

  it("recognizes cautious likely arranger variants", () => {
    expect(areLikelySameArranger("Cay Outerbridge", "C. Outerbridge")).toBe(
      true
    );
    expect(areLikelySameArranger("Cay Outerbridge", "Outerbridge")).toBe(true);
    expect(areLikelySameArranger("Outerbridge", "C. Outerbridge")).toBe(true);
  });

  it("does not collapse clearly different arranger names", () => {
    expect(areLikelySameArranger("Cay Outerbridge", "David Wright")).toBe(
      false
    );
    expect(areLikelySameArranger("David Wright", "Doug Wright")).toBe(false);
  });
});
