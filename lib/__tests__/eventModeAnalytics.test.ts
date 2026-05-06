import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics";

const repoRoot = process.cwd();
const eventModePage = readFileSync(join(repoRoot, "app/event-mode/page.tsx"), "utf8");
const eventModeDetailPage = readFileSync(
  join(repoRoot, "app/event-mode/[code]/page.tsx"),
  "utf8"
);
const eventModeSources = `${eventModePage}\n${eventModeDetailPage}`;

describe("Event Mode analytics", () => {
  const eventModeEvents = [
    "event_mode_viewed",
    "event_mode_event_search_submitted",
    "event_mode_event_created",
    "event_mode_event_used",
    "event_mode_availability_created",
    "event_mode_availability_updated",
    "event_mode_availability_turned_off",
    "event_mode_available_singer_filter_used",
    "event_mode_message_started",
    "event_mode_message_sent",
    "event_mode_message_replied",
    "event_mode_start_quartet_clicked",
  ];

  it("declares and emits Event Mode events through the shared analytics wrapper", () => {
    for (const eventName of eventModeEvents) {
      expect(ANALYTICS_EVENT_NAMES).toContain(eventName);
      expect(eventModeSources).toContain(eventName);
    }

    expect(eventModeSources).toContain('import { trackEvent } from "@/lib/analytics"');
  });

  it("uses bucketed Event Mode properties instead of raw user text", () => {
    expect(eventModeSources).toContain("result_count");
    expect(eventModeSources).toContain("has_search");
    expect(eventModeSources).toContain("selected_voice_part_count");
    expect(eventModeSources).toContain("has_availability");
    expect(eventModeSources).toContain("has_meetup");
    expect(eventModeSources).toContain("availability_count");
    expect(eventModeSources).toContain("message_count");
    expect(eventModeSources).toContain("visibility");
    expect(eventModeSources).toContain("lifecycle");
    expect(eventModeSources).not.toContain("search_text");
    expect(eventModeSources).not.toContain("event_name");
    expect(eventModeSources).not.toContain("event_code");
    expect(eventModeSources).not.toContain("message_body");
  });
});
