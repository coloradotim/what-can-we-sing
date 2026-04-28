import { describe, expect, it } from "vitest";
import { isLikelySameSongTitle } from "../fuzzySongTitles";

describe("isLikelySameSongTitle", () => {
  it("recognizes conservative typo variants for quartet matching", () => {
    expect(isLikelySameSongTitle("Hello Mary Lu", "Hello, Mary Lou!")).toBe(
      true
    );
  });

  it("recognizes likely partial title variants for quartet matching", () => {
    expect(
      isLikelySameSongTitle(
        "Why Try to Change Me",
        "Why Try To Change Me Now"
      )
    ).toBe(true);
  });

  it("does not treat exact normalized titles as fuzzy variants", () => {
    expect(isLikelySameSongTitle("Hello Mary Lou", "Hello, Mary Lou!")).toBe(
      false
    );
  });

  it("avoids obvious false positives", () => {
    expect(
      isLikelySameSongTitle("Hello Mary Lou", "Goodbye My Coney Island Baby")
    ).toBe(false);
  });
});
