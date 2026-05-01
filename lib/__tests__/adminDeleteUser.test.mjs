import { describe, expect, it } from "vitest";
import {
  deletionOrder,
  formatDeletionSummary,
  parseDeleteUserArgs,
  userOwnedTables,
} from "../../scripts/admin/delete-user-core.mjs";

describe("admin delete user helpers", () => {
  it("defaults exact email deletion requests to dry-run mode", () => {
    const options = parseDeleteUserArgs(["--email", "Singer@Example.com"], {});

    expect(options.identifier).toEqual({
      type: "email",
      value: "singer@example.com",
    });
    expect(options.dryRun).toBe(true);
    expect(options.confirm).toBe(false);
  });

  it("requires one exact identifier", () => {
    expect(() => parseDeleteUserArgs([], {})).toThrow(
      "Provide an exact --email or --user-id."
    );
    expect(() =>
      parseDeleteUserArgs(
        [
          "--email",
          "a@example.com",
          "--user-id",
          "46eed8b7-4a11-46e2-8c40-f22f3005ff77",
        ],
        {}
      )
    ).toThrow("Use either --email or --user-id, not both.");
    expect(() => parseDeleteUserArgs(["--email", "*@example.com"], {})).toThrow(
      "wildcards are not allowed"
    );
    expect(() =>
      parseDeleteUserArgs(["--email", "a@example.com", "--force"], {})
    ).toThrow("Unknown option: --force.");
  });

  it("validates user IDs as exact auth UUIDs", () => {
    expect(() => parseDeleteUserArgs(["--user-id", "not-a-user"], {})).toThrow(
      "User ID must be an exact Supabase auth UUID."
    );

    const options = parseDeleteUserArgs(
      ["--user-id", "46eed8b7-4a11-46e2-8c40-f22f3005ff77"],
      {}
    );

    expect(options.identifier).toEqual({
      type: "user-id",
      value: "46eed8b7-4a11-46e2-8c40-f22f3005ff77",
    });
  });

  it("requires an extra confirmation flag for production deletes", () => {
    expect(() =>
      parseDeleteUserArgs(["--email", "singer@example.com", "--confirm"], {
        WCWS_ADMIN_ENV: "production",
      })
    ).toThrow("Production deletion requires --confirm-production");

    const options = parseDeleteUserArgs(
      [
        "--email",
        "singer@example.com",
        "--confirm",
        "--confirm-production",
      ],
      { WCWS_ADMIN_ENV: "production" }
    );

    expect(options.dryRun).toBe(false);
    expect(options.production).toBe(true);
  });

  it("targets only user-owned app tables before deleting auth", () => {
    expect(deletionOrder()).toEqual([
      "session_participants",
      "sung_song_events",
      "user_repertoire",
      "profiles",
    ]);
    expect(userOwnedTables.map((item) => item.table)).not.toContain("sessions");
    expect(userOwnedTables.map((item) => item.table)).not.toContain(
      "song_suggestion_catalog"
    );
  });

  it("summarizes counts without exposing repertoire or feedback content", () => {
    const summary = formatDeletionSummary({
      user: {
        id: "46eed8b7-4a11-46e2-8c40-f22f3005ff77",
        email: "singer@example.com",
      },
      counts: {
        profiles: 1,
        user_repertoire: 12,
        session_participants: 2,
        sung_song_events: 3,
      },
      dryRun: true,
      production: false,
    });

    expect(summary).toContain("DRY RUN");
    expect(summary).toContain("Repertoire entries: 12");
    expect(summary).toContain("Preserved: sessions");
    expect(summary).toContain("Preserved: song_suggestion_catalog");
    expect(summary).not.toContain("song_title");
    expect(summary).not.toContain("message");
  });
});
