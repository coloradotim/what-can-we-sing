import posthog from "posthog-js";

export type AnalyticsEventName =
  | "analytics_client_ready"
  | "app_route_viewed"
  | "user_logged_in"
  | "quartet_created"
  | "quartet_join_attempted"
  | "repertoire_song_added"
  | "repertoire_song_edited"
  | "repertoire_song_deleted"
  | "repertoire_updated"
  | "repertoire_update_failed"
  | "quartet_started"
  | "quartet_joined"
  | "quartet_join_failed"
  | "quartet_leave_clicked"
  | "quartet_leave_confirmed"
  | "quartet_left"
  | "quartet_leave_failed"
  | "quartet_rejoined"
  | "quartet_full"
  | "quartet_member_removed"
  | "quartet_matches_viewed"
  | "matches_generated"
  | "zero_matches_found"
  | "song_marked_sung"
  | "song_mark_sung_failed"
  | "help_viewed"
  | "feedback_submitted"
  | "feedback_failed"
  | "event_mode_viewed"
  | "event_mode_event_search_submitted"
  | "event_mode_event_created"
  | "event_mode_event_used"
  | "event_mode_availability_created"
  | "event_mode_availability_updated"
  | "event_mode_availability_turned_off"
  | "event_mode_available_singer_filter_used"
  | "event_mode_message_started"
  | "event_mode_message_sent"
  | "event_mode_message_replied"
  | "event_mode_start_quartet_clicked";

export const ANALYTICS_EVENT_NAMES = [
  "analytics_client_ready",
  "app_route_viewed",
  "user_logged_in",
  "quartet_created",
  "quartet_join_attempted",
  "repertoire_song_added",
  "repertoire_song_edited",
  "repertoire_song_deleted",
  "repertoire_updated",
  "repertoire_update_failed",
  "quartet_started",
  "quartet_joined",
  "quartet_join_failed",
  "quartet_leave_clicked",
  "quartet_leave_confirmed",
  "quartet_left",
  "quartet_leave_failed",
  "quartet_rejoined",
  "quartet_full",
  "quartet_member_removed",
  "quartet_matches_viewed",
  "matches_generated",
  "zero_matches_found",
  "song_marked_sung",
  "song_mark_sung_failed",
  "help_viewed",
  "feedback_submitted",
  "feedback_failed",
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
] as const satisfies readonly AnalyticsEventName[];

type AnalyticsPropertyValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

const blockedPropertyFragments = [
  "arranger",
  "email",
  "feedback",
  "message",
  "name",
  "note",
  "text",
  "title",
];

function hasPostHogConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST
  );
}

function canUsePostHog() {
  return typeof window !== "undefined" && hasPostHogConfig();
}

export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties = {}
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      const hasBlockedKey = blockedPropertyFragments.some((fragment) =>
        normalizedKey.includes(fragment)
      );

      if (hasBlockedKey || value === undefined) return false;

      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      );
    })
  );
}

export function getAnalyticsRoute(pathname: string | null | undefined) {
  if (!pathname) return "/";

  const normalizedPathname = pathname.split("?")[0]?.split("#")[0] || "/";
  const segments = normalizedPathname.split("/").filter(Boolean);

  if (segments[0] === "join" && segments.length > 1) {
    return "/join/[code]";
  }

  if (segments[0] === "event-mode" && segments.length > 1) {
    return "/event-mode/[code]";
  }

  return normalizedPathname || "/";
}

export function trackEvent(
  eventName: AnalyticsEventName,
  properties?: AnalyticsProperties
) {
  try {
    if (!canUsePostHog()) return;

    posthog.capture(eventName, sanitizeAnalyticsProperties(properties));
  } catch (err) {
    console.error("Analytics event failed", err);
  }
}

export function identifyAnalyticsUser(userId: string | null | undefined) {
  try {
    if (!canUsePostHog() || !userId) return;

    posthog.identify(userId);
  } catch (err) {
    console.error("Analytics identify failed", err);
  }
}

export function resetAnalytics() {
  try {
    if (!canUsePostHog()) return;

    posthog.reset();
  } catch (err) {
    console.error("Analytics reset failed", err);
  }
}
