import { describe, expect, it } from "vitest";
import { arrangerDisplayName, hasArrangerEntered } from "../arrangerDisplay";

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
});
