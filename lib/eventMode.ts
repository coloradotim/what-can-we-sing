import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/profileStore";

export type EventModeVisibility = "listed" | "unlisted";
export type EventModeLifecycle = "upcoming" | "active" | "ended";

export type EventModeEvent = {
  id: string;
  name: string;
  normalized_name: string;
  city: string | null;
  venue_or_location_note: string | null;
  start_at: string;
  end_at: string;
  visibility: EventModeVisibility;
  join_code: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type EventModeEventInput = {
  name: string;
  city?: string;
  venueOrLocationNote?: string;
  startAt: string;
  endAt: string;
  visibility: EventModeVisibility;
};

export type EventModeDuplicateCandidate = {
  event: EventModeEvent;
  reasons: string[];
};

const eventCodePattern = /^[A-Z0-9]{6}$/;

function cleanText(value: string | null | undefined) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export function normalizeEventModeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseEventModeCode(value: string) {
  const trimmed = value.trim();
  const directCode = trimmed.toUpperCase();

  if (eventCodePattern.test(directCode)) return directCode;

  try {
    const url = new URL(trimmed);
    const [, route, code] = url.pathname.split("/");
    if (route !== "event-mode" || !code) return null;

    const parsedCode = decodeURIComponent(code).trim().toUpperCase();
    return eventCodePattern.test(parsedCode) ? parsedCode : null;
  } catch {
    return null;
  }
}

export function eventModePathFromCode(code: string) {
  const parsedCode = parseEventModeCode(code);
  return parsedCode ? `/event-mode/${parsedCode}` : null;
}

export function makeEventModeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function getEventModeLifecycle(
  event: Pick<EventModeEvent, "start_at" | "end_at" | "closed_at">,
  now = new Date()
): EventModeLifecycle {
  if (event.closed_at) return "ended";

  const nowTime = now.getTime();
  const startTime = Date.parse(event.start_at);
  const endTime = Date.parse(event.end_at);

  if (nowTime < startTime) return "upcoming";
  if (nowTime <= endTime) return "active";
  return "ended";
}

export function formatEventModeDateRange(event: {
  start_at: string;
  end_at: string;
}) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const sameDay = sameMonth && start.getDate() === end.getDate();
  const startFormat = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endFormat = new Intl.DateTimeFormat(undefined, {
    month: sameMonth ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    year: "numeric",
  });

  if (sameDay) return startFormat.format(start);
  return `${startFormat.format(start)}-${endFormat.format(end)}`;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return Date.parse(aStart) <= Date.parse(bEnd) && Date.parse(bStart) <= Date.parse(aEnd);
}

function hasUsefulTokenOverlap(left: string, right: string) {
  const genericEventTokens = new Set([
    "convention",
    "district",
    "event",
    "weekend",
    "singing",
  ]);
  const isUsefulToken = (token: string) =>
    token.length >= 3 && !genericEventTokens.has(token);
  const leftTokens = new Set(left.split(" ").filter(isUsefulToken));
  const rightTokens = right.split(" ").filter(isUsefulToken);

  return rightTokens.some((token) => leftTokens.has(token));
}

export function eventModeSearchMatches(event: EventModeEvent, query: string) {
  const normalizedQuery = normalizeEventModeText(query);
  if (!normalizedQuery) return true;

  return [
    event.normalized_name,
    event.city,
    event.venue_or_location_note,
  ].some((value) => normalizeEventModeText(value).includes(normalizedQuery));
}

export function findEventModeDuplicateCandidates(
  input: Pick<EventModeEventInput, "name" | "city" | "venueOrLocationNote" | "startAt" | "endAt">,
  existingEvents: EventModeEvent[],
  now = new Date()
): EventModeDuplicateCandidate[] {
  const inputName = normalizeEventModeText(input.name);
  const inputLocation = normalizeEventModeText(
    [input.city, input.venueOrLocationNote].filter(Boolean).join(" ")
  );

  if (!inputName) return [];

  return existingEvents
    .filter((event) => getEventModeLifecycle(event, now) !== "ended")
    .map((event) => {
      const reasons: string[] = [];
      const eventName = normalizeEventModeText(event.name);
      const eventLocation = normalizeEventModeText(
        [event.city, event.venue_or_location_note].filter(Boolean).join(" ")
      );

      if (
        eventName === inputName ||
        eventName.includes(inputName) ||
        inputName.includes(eventName) ||
        hasUsefulTokenOverlap(eventName, inputName)
      ) {
        reasons.push("similar name");
      }

      if (rangesOverlap(input.startAt, input.endAt, event.start_at, event.end_at)) {
        reasons.push("overlapping dates");
      }

      if (
        inputLocation &&
        eventLocation &&
        (eventLocation.includes(inputLocation) ||
          inputLocation.includes(eventLocation) ||
          hasUsefulTokenOverlap(eventLocation, inputLocation))
      ) {
        reasons.push("similar location");
      }

      return { event, reasons };
    })
    .filter((candidate) => {
      const hasName = candidate.reasons.includes("similar name");
      const hasDates = candidate.reasons.includes("overlapping dates");
      const hasLocation = candidate.reasons.includes("similar location");
      return hasName && (hasDates || hasLocation);
    })
    .sort((a, b) => {
      return (
        b.reasons.length - a.reasons.length ||
        Date.parse(a.event.start_at) - Date.parse(b.event.start_at) ||
        a.event.name.localeCompare(b.event.name)
      );
    });
}

function validateEventModeInput(input: EventModeEventInput) {
  const name = cleanText(input.name);
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  if (!name) throw new Error("Event name is required.");
  if (!input.startAt || Number.isNaN(startAt.getTime())) {
    throw new Error("Start date and time are required.");
  }
  if (!input.endAt || Number.isNaN(endAt.getTime())) {
    throw new Error("End date and time are required.");
  }
  if (endAt <= startAt) {
    throw new Error("End date and time must be after the start.");
  }
  if (input.visibility !== "listed" && input.visibility !== "unlisted") {
    throw new Error("Choose listed or unlisted visibility.");
  }

  return {
    name,
    normalized_name: normalizeEventModeText(name),
    city: cleanText(input.city),
    venue_or_location_note: cleanText(input.venueOrLocationNote),
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    visibility: input.visibility,
  };
}

export async function searchEventModeEvents(query: string, now = new Date()) {
  const { data, error } = await supabase
    .from("event_mode_events")
    .select("*")
    .eq("visibility", "listed")
    .is("closed_at", null)
    .gte("end_at", now.toISOString())
    .order("start_at", { ascending: true })
    .limit(200);

  if (error) throw error;
  return ((data ?? []) as EventModeEvent[]).filter((event) =>
    eventModeSearchMatches(event, query)
  );
}

export async function createEventModeEvent(input: EventModeEventInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in to create an event.");

  const values = validateEventModeInput(input);
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("event_mode_events")
      .insert({
        ...values,
        join_code: makeEventModeJoinCode(),
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (!error) return data as EventModeEvent;
    lastError = error;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not create the event.");
}

export async function getEventModeEventByCode(code: string) {
  const parsedCode = parseEventModeCode(code);
  if (!parsedCode) return null;

  const { data, error } = await supabase.rpc("get_event_mode_event_by_code", {
    p_code: parsedCode,
  });

  if (error) throw error;
  const rows = (data ?? []) as EventModeEvent[];
  return rows[0] ?? null;
}

export async function updateEventModeEvent(
  eventId: string,
  input: EventModeEventInput
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in to edit this event.");

  const values = validateEventModeInput(input);
  const { data, error } = await supabase
    .from("event_mode_events")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("created_by_user_id", user.id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Only the event creator can edit this event.");
  return data as EventModeEvent;
}

export async function closeEventModeEvent(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in to close this event.");

  const { data, error } = await supabase
    .from("event_mode_events")
    .update({
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("created_by_user_id", user.id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Only the event creator can close this event.");
  return data as EventModeEvent;
}
