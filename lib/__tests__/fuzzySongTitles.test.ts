import { describe, expect, it } from "vitest";
import { findFuzzySongTitleSuggestions } from "../fuzzySongTitles";

describe("findFuzzySongTitleSuggestions", () => {
  it("suggests conservative same-voicing typo matches", () => {
    const suggestions = findFuzzySongTitleSuggestions([
      { id: "1", songTitle: "Hello Mary Lu", voicing: "TTBB" },
      { id: "2", songTitle: "Hello, Mary Lou!", voicing: "TTBB" },
    ]);

    expect(suggestions).toEqual([
      {
        id: "1:2",
        itemId: "1",
        itemTitle: "Hello Mary Lu",
        suggestedItemId: "2",
        suggestedTitle: "Hello, Mary Lou!",
        voicing: "TTBB",
      },
    ]);
  });

  it("suggests likely partial title matches", () => {
    const suggestions = findFuzzySongTitleSuggestions([
      { id: "1", songTitle: "Mary Lou", voicing: "TTBB" },
      { id: "2", songTitle: "Hello, Mary Lou!", voicing: "TTBB" },
    ]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      itemTitle: "Mary Lou",
      suggestedTitle: "Hello, Mary Lou!",
      voicing: "TTBB",
    });
  });

  it("does not suggest exact normalized matches", () => {
    const suggestions = findFuzzySongTitleSuggestions([
      { id: "1", songTitle: "Hello Mary Lou", voicing: "TTBB" },
      { id: "2", songTitle: "Hello, Mary Lou!", voicing: "TTBB" },
    ]);

    expect(suggestions).toEqual([]);
  });

  it("does not compare titles across different voicings", () => {
    const suggestions = findFuzzySongTitleSuggestions([
      { id: "1", songTitle: "Hello Mary Lu", voicing: "TTBB" },
      { id: "2", songTitle: "Hello, Mary Lou!", voicing: "SSAA" },
    ]);

    expect(suggestions).toEqual([]);
  });

  it("avoids obvious false positives", () => {
    const suggestions = findFuzzySongTitleSuggestions([
      { id: "1", songTitle: "Hello Mary Lou", voicing: "TTBB" },
      { id: "2", songTitle: "Goodbye My Coney Island Baby", voicing: "TTBB" },
      { id: "3", songTitle: "Sweet Adeline", voicing: "TTBB" },
    ]);

    expect(suggestions).toEqual([]);
  });
});
