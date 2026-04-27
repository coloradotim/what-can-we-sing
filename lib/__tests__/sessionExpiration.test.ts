import { describe, expect, it } from "vitest";
import {
  isSessionExpired,
  sessionExpirationLabel,
  sessionLastActivityAt,
} from "../sessionExpiration";

describe("session expiration", () => {
  const now = new Date("2026-04-27T12:00:00.000Z");

  it("uses last_activity_at when present", () => {
    expect(
      sessionLastActivityAt({
        created_at: "2026-04-25T12:00:00.000Z",
        last_activity_at: "2026-04-27T10:00:00.000Z",
      })
    ).toBe("2026-04-27T10:00:00.000Z");
  });

  it("falls back to created_at for older rows", () => {
    expect(
      sessionLastActivityAt({
        created_at: "2026-04-27T10:00:00.000Z",
      })
    ).toBe("2026-04-27T10:00:00.000Z");
  });

  it("marks quartets expired after 24 hours of inactivity", () => {
    expect(
      isSessionExpired(
        {
          created_at: "2026-04-26T11:59:59.000Z",
        },
        now
      )
    ).toBe(true);
  });

  it("keeps quartets active before the 24 hour window ends", () => {
    expect(
      isSessionExpired(
        {
          created_at: "2026-04-26T12:00:01.000Z",
        },
        now
      )
    ).toBe(false);
  });

  it("shows a rounded hours label", () => {
    expect(
      sessionExpirationLabel(
        {
          created_at: "2026-04-27T11:00:01.000Z",
        },
        now
      )
    ).toBe("Expires in 24h");
  });

  it("shows expires soon with less than one hour left", () => {
    expect(
      sessionExpirationLabel(
        {
          created_at: "2026-04-26T12:30:01.000Z",
        },
        now
      )
    ).toBe("Expires soon");
  });
});
