import { describe, expect, it } from "vitest";
import { formatLastSungStatus } from "../lastSung";

describe("formatLastSungStatus", () => {
  it("uses not-marked language for missing or invalid dates", () => {
    expect(formatLastSungStatus(null)).toBe("Not marked yet");
    expect(formatLastSungStatus("not-a-date")).toBe("Not marked yet");
  });

  it("shows today for songs marked on the current local day", () => {
    expect(
      formatLastSungStatus(
        "2026-05-01T18:00:00.000Z",
        new Date("2026-05-01T20:00:00.000Z")
      )
    ).toBe("Today");
  });

  it("shows recent day counts for songs marked within two weeks", () => {
    expect(
      formatLastSungStatus(
        "2026-04-29T18:00:00.000Z",
        new Date("2026-05-01T20:00:00.000Z")
      )
    ).toBe("2 days ago");
  });

  it("uses a compact date for older marks", () => {
    const label = formatLastSungStatus(
      "2026-04-01T18:00:00.000Z",
      new Date("2026-05-01T20:00:00.000Z")
    );

    expect(label).toContain("Apr");
    expect(label).toContain("1");
  });
});
