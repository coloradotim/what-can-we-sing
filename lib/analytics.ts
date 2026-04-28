import posthog from "posthog-js";

export type AnalyticsEventName =
  | "user_logged_in"
  | "repertoire_song_added"
  | "repertoire_song_edited"
  | "repertoire_song_deleted"
  | "quartet_started"
  | "quartet_joined"
  | "quartet_left"
  | "quartet_member_removed"
  | "quartet_matches_viewed"
  | "song_marked_sung"
  | "song_mark_sung_failed"
  | "help_viewed"
  | "feedback_submitted";

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
