import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EventModeAvailability, EventModeEvent } from "@/lib/eventMode";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

const {
  defaultEventModeAvailableUntil,
  eventModeVoicePartOptions,
  eventModeSearchMatches,
  filterEventModeAvailabilityByPart,
  findEventModeDuplicateCandidates,
  formatEventModeVoiceParts,
  getEventModeLifecycle,
  isEventModeAvailabilityActive,
  normalizeEventModeText,
  parseEventModeCode,
  validateEventModeMessageBody,
} = await import("@/lib/eventMode");

const storeSource = readFileSync(
  join(process.cwd(), "lib/eventMode.ts"),
  "utf8"
);

function event(overrides: Partial<EventModeEvent> = {}): EventModeEvent {
  return {
    id: "event-1",
    name: "Rocky Mountain District Fall Convention",
    normalized_name: "rocky mountain district fall convention",
    city: "Denver, CO",
    venue_or_location_note: "Convention hotel",
    start_at: "2026-10-09T18:00:00.000Z",
    end_at: "2026-10-11T18:00:00.000Z",
    visibility: "listed",
    join_code: "ABC123",
    created_by_user_id: "user-1",
    created_at: "2026-05-02T00:00:00.000Z",
    updated_at: "2026-05-02T00:00:00.000Z",
    closed_at: null,
    ...overrides,
  };
}

describe("Event Mode helpers", () => {
  it("normalizes search text without making Event Mode GPS-like", () => {
    expect(normalizeEventModeText("  BHS Midwinter—San Antonio! ")).toBe(
      "bhs midwinter san antonio"
    );
  });

  it("parses six-character event codes and event-mode links", () => {
    expect(parseEventModeCode(" ab12cd ")).toBe("AB12CD");
    expect(parseEventModeCode("https://example.com/event-mode/xy98zz")).toBe(
      "XY98ZZ"
    );
    expect(parseEventModeCode("https://example.com/join/xy98zz")).toBeNull();
  });

  it("derives upcoming, active, and ended lifecycle from event dates and closure", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");

    expect(getEventModeLifecycle(event(), now)).toBe("active");
    expect(
      getEventModeLifecycle(
        event({
          start_at: "2026-10-12T18:00:00.000Z",
          end_at: "2026-10-14T18:00:00.000Z",
        }),
        now
      )
    ).toBe("upcoming");
    expect(
      getEventModeLifecycle(
        event({ closed_at: "2026-10-10T13:00:00.000Z" }),
        now
      )
    ).toBe("ended");
  });

  it("matches listed event searches by name, city, or location note", () => {
    const candidate = event();

    expect(eventModeSearchMatches(candidate, "Rocky Mountain")).toBe(true);
    expect(eventModeSearchMatches(candidate, "Denver")).toBe(true);
    expect(eventModeSearchMatches(candidate, "hotel")).toBe(true);
    expect(eventModeSearchMatches(candidate, "Midwinter")).toBe(false);
  });

  it("finds possible duplicates by similar name plus overlapping date or location", () => {
    const candidates = findEventModeDuplicateCandidates(
      {
        name: "RMD Fall Convention",
        city: "Denver",
        venueOrLocationNote: "",
        startAt: "2026-10-10T00:00:00.000Z",
        endAt: "2026-10-12T00:00:00.000Z",
      },
      [
        event({
          name: "Rocky Mountain District Fall Convention",
          normalized_name: "rocky mountain district fall convention",
        }),
        event({
          id: "event-2",
          name: "Sunshine District Spring Convention",
          normalized_name: "sunshine district spring convention",
          city: "Orlando, FL",
        }),
      ],
      new Date("2026-05-02T00:00:00.000Z")
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].event.name).toBe(
      "Rocky Mountain District Fall Convention"
    );
    expect(candidates[0].reasons).toContain("similar location");
  });

  it("keeps Event Mode browsing scoped to listed active or upcoming events", () => {
    expect(storeSource).toContain('.eq("visibility", "listed")');
    expect(storeSource).toContain('.is("closed_at", null)');
    expect(storeSource).toContain('.gte("end_at", now.toISOString())');
    expect(storeSource).toContain("get_event_mode_event_by_code");
  });

  it("uses unambiguous Event Mode voice part labels", () => {
    expect(eventModeVoicePartOptions).toContain("TTBB Lead");
    expect(eventModeVoicePartOptions).toContain("SATB Tenor");
    expect(eventModeVoicePartOptions).toContain("SSAA Alto 1");
    expect(eventModeVoicePartOptions).not.toContain("Lead");
    expect(eventModeVoicePartOptions).not.toContain("Tenor");
    expect(formatEventModeVoiceParts(["TTBB Lead", "SATB Tenor"])).toBe(
      "Lower voice (TTBB) Lead, Mixed (SATB) Baritone"
    );
  });

  it("defaults availability expiry to the event end when it is soon", () => {
    expect(
      defaultEventModeAvailableUntil(
        event({ end_at: "2026-10-11T18:00:00.000Z" }),
        new Date("2026-10-10T18:00:00.000Z")
      )
    ).toBe("2026-10-11T18:00:00.000Z");
  });

  it("falls back to a one-day availability expiry for far-future events", () => {
    expect(
      defaultEventModeAvailableUntil(
        event({ end_at: "2026-11-11T18:00:00.000Z" }),
        new Date("2026-10-10T18:00:00.000Z")
      )
    ).toBe("2026-10-11T18:00:00.000Z");
  });

  it("filters Event Mode availability by selected voice part", () => {
    const items: EventModeAvailability[] = [
      {
        id: "availability-1",
        event_id: "event-1",
        user_id: "user-1",
        display_name: "Tim",
        voice_parts: ["TTBB Lead", "TTBB Bass"],
        availability_note: null,
        meetup_note: null,
        available_until: "2026-10-10T20:00:00.000Z",
        created_at: "2026-10-10T18:00:00.000Z",
        updated_at: "2026-10-10T18:00:00.000Z",
        turned_off_at: null,
      },
      {
        id: "availability-2",
        event_id: "event-1",
        user_id: "user-2",
        display_name: "Alex",
        voice_parts: ["SSAA Alto 1"],
        availability_note: null,
        meetup_note: null,
        available_until: "2026-10-10T20:00:00.000Z",
        created_at: "2026-10-10T18:00:00.000Z",
        updated_at: "2026-10-10T18:00:00.000Z",
        turned_off_at: null,
      },
    ];

    expect(filterEventModeAvailabilityByPart(items, "all")).toHaveLength(2);
    expect(filterEventModeAvailabilityByPart(items, "TTBB Bass")).toEqual([
      items[0],
    ]);
    expect(filterEventModeAvailabilityByPart(items, "SATB Alto")).toEqual([]);
  });

  it("treats expired, ended, and turned-off availability as inactive", () => {
    const now = new Date("2026-10-10T18:00:00.000Z");
    const active = {
      available_until: "2026-10-10T20:00:00.000Z",
      turned_off_at: null,
    };

    expect(isEventModeAvailabilityActive(active, event(), now)).toBe(true);
    expect(
      isEventModeAvailabilityActive(
        { ...active, available_until: "2026-10-10T17:00:00.000Z" },
        event(),
        now
      )
    ).toBe(false);
    expect(
      isEventModeAvailabilityActive(
        { ...active, turned_off_at: "2026-10-10T17:30:00.000Z" },
        event(),
        now
      )
    ).toBe(false);
    expect(
      isEventModeAvailabilityActive(
        active,
        event({ closed_at: "2026-10-10T17:30:00.000Z" }),
        now
      )
    ).toBe(false);
  });

  it("writes availability as one row per user and event", () => {
    expect(storeSource).toContain(".from(\"event_mode_availability\")");
    expect(storeSource).toContain("{ onConflict: \"event_id,user_id\" }");
    expect(storeSource).toContain("get_event_mode_availability_by_code");
    expect(storeSource).toContain('.eq("user_id", user.id)');
  });

  it("keeps Event Mode messaging event-scoped and app-mediated", () => {
    expect(validateEventModeMessageBody("  See you in the lobby?  ")).toBe(
      "See you in the lobby?"
    );
    expect(() => validateEventModeMessageBody("   ")).toThrow(
      "Message is required."
    );
    expect(() => validateEventModeMessageBody("x".repeat(1001))).toThrow(
      "1000 characters"
    );

    expect(storeSource).toContain("get_event_mode_messages_by_code");
    expect(storeSource).toContain("send_event_mode_message");
    expect(storeSource).toContain("report_event_mode_message");
    expect(storeSource).toContain("block_event_mode_user");
    expect(storeSource).not.toContain("Invite to quartet");
  });
});
