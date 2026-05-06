import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/profileStore";
import {
  functionalPartName,
  voicingDisplayLabel,
} from "@/lib/partAbbreviations";
import type { Part, Voicing } from "@/lib/matching";

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

export type EventModeVoicePart =
  | "TTBB Tenor"
  | "TTBB Lead"
  | "TTBB Baritone"
  | "TTBB Bass"
  | "SATB Soprano"
  | "SATB Alto"
  | "SATB Tenor"
  | "SATB Bass"
  | "SSAA Soprano 1"
  | "SSAA Soprano 2"
  | "SSAA Alto 1"
  | "SSAA Alto 2";

export type EventModeAvailability = {
  id: string;
  event_id: string;
  user_id: string;
  display_name: string;
  voice_parts: EventModeVoicePart[];
  availability_note: string | null;
  meetup_note: string | null;
  available_until: string;
  created_at: string;
  updated_at: string;
  turned_off_at: string | null;
};

export type EventModeAvailabilityInput = {
  eventId: string;
  voiceParts: EventModeVoicePart[];
  availabilityNote?: string;
  meetupNote?: string;
  availableUntil: string;
};

export type EventModeMessage = {
  id: string;
  event_id: string;
  sender_user_id: string;
  sender_display_name: string;
  recipient_user_id: string;
  recipient_display_name: string;
  recipient_availability_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
  reported_by_me: boolean;
  blocked_by_me: boolean;
};

export type EventModeMessageInput = {
  eventId: string;
  recipientUserId: string;
  body: string;
  recipientAvailabilityId?: string | null;
};

export const eventModeVoicePartGroups = [
  {
    voicing: "TTBB",
    label: "Lower voice (TTBB)",
    parts: ["TTBB Tenor", "TTBB Lead", "TTBB Baritone", "TTBB Bass"],
  },
  {
    voicing: "SATB",
    label: "Mixed (SATB)",
    parts: ["SATB Soprano", "SATB Alto", "SATB Tenor", "SATB Bass"],
  },
  {
    voicing: "SSAA",
    label: "Treble (SSAA)",
    parts: [
      "SSAA Soprano 1",
      "SSAA Soprano 2",
      "SSAA Alto 1",
      "SSAA Alto 2",
    ],
  },
] satisfies { voicing: Voicing; label: string; parts: EventModeVoicePart[] }[];

export const eventModeVoicePartOptions = eventModeVoicePartGroups.flatMap(
  (group) => group.parts
);

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

export function defaultEventModeAvailableUntil(
  event: Pick<EventModeEvent, "end_at">,
  now = new Date()
) {
  const eventEnd = new Date(event.end_at);
  const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (
    !Number.isNaN(eventEnd.getTime()) &&
    eventEnd > now &&
    eventEnd <= sevenDaysFromNow
  ) {
    return eventEnd.toISOString();
  }

  return fallback.toISOString();
}

export function formatEventModeVoiceParts(parts: EventModeVoicePart[]) {
  return parts.map(formatEventModeVoicePart).join(", ");
}

export function formatEventModeVoicePart(part: EventModeVoicePart) {
  const [voicing, ...partWords] = part.split(" ");
  const canonicalVoicing = voicing as Voicing;
  const storedPart = partWords.join(" ") as Part;

  return `${voicingDisplayLabel(canonicalVoicing)} ${functionalPartName(
    canonicalVoicing,
    storedPart
  )}`;
}

export function isEventModeAvailabilityActive(
  availability: Pick<EventModeAvailability, "available_until" | "turned_off_at">,
  event: Pick<EventModeEvent, "end_at" | "closed_at">,
  now = new Date()
) {
  if (availability.turned_off_at || event.closed_at) return false;
  return (
    Date.parse(availability.available_until) > now.getTime() &&
    Date.parse(event.end_at) > now.getTime()
  );
}

export function filterEventModeAvailabilityByPart(
  availability: EventModeAvailability[],
  selectedPart: EventModeVoicePart | "all"
) {
  if (selectedPart === "all") return availability;
  return availability.filter((item) => item.voice_parts.includes(selectedPart));
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

function validateEventModeAvailabilityInput(input: EventModeAvailabilityInput) {
  const availableUntil = new Date(input.availableUntil);
  const uniqueVoiceParts = Array.from(new Set(input.voiceParts));

  if (uniqueVoiceParts.length === 0) {
    throw new Error("Choose at least one voice part.");
  }
  if (
    uniqueVoiceParts.some((part) => !eventModeVoicePartOptions.includes(part))
  ) {
    throw new Error("Choose valid Event Mode voice parts.");
  }
  if (!input.availableUntil || Number.isNaN(availableUntil.getTime())) {
    throw new Error("Choose when your availability should expire.");
  }
  if (availableUntil <= new Date()) {
    throw new Error("Availability must expire in the future.");
  }

  return {
    event_id: input.eventId,
    voice_parts: uniqueVoiceParts,
    availability_note: cleanText(input.availabilityNote),
    meetup_note: cleanText(input.meetupNote),
    available_until: availableUntil.toISOString(),
  };
}

export function validateEventModeMessageBody(value: string | null | undefined) {
  const body = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!body) throw new Error("Message is required.");
  if (body.length > 1000) {
    throw new Error("Message must be 1000 characters or fewer.");
  }
  return body;
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

export async function getEventModeAvailabilityByCode(code: string) {
  const parsedCode = parseEventModeCode(code);
  if (!parsedCode) return [];

  const { data, error } = await supabase.rpc(
    "get_event_mode_availability_by_code",
    {
      p_code: parsedCode,
    }
  );

  if (error) throw error;
  return (data ?? []) as EventModeAvailability[];
}

export async function upsertEventModeAvailability(
  input: EventModeAvailabilityInput
) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to mark yourself available.");
  }

  const values = validateEventModeAvailabilityInput(input);
  const { data, error } = await supabase
    .from("event_mode_availability")
    .upsert(
      {
        ...values,
        user_id: user.id,
        turned_off_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Omit<EventModeAvailability, "display_name">;
}

export async function turnOffEventModeAvailability(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in to turn off availability.");

  const { data, error } = await supabase
    .from("event_mode_availability")
    .update({
      turned_off_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .is("turned_off_at", null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Omit<EventModeAvailability, "display_name"> | null;
}

export async function getEventModeMessagesByCode(code: string) {
  const parsedCode = parseEventModeCode(code);
  if (!parsedCode) return [];

  const { data, error } = await supabase.rpc("get_event_mode_messages_by_code", {
    p_code: parsedCode,
  });

  if (error) throw error;
  return (data ?? []) as EventModeMessage[];
}

export async function sendEventModeMessage(input: EventModeMessageInput) {
  const body = validateEventModeMessageBody(input.body);
  const { data, error } = await supabase.rpc("send_event_mode_message", {
    p_event_id: input.eventId,
    p_recipient_user_id: input.recipientUserId,
    p_recipient_availability_id: input.recipientAvailabilityId ?? null,
    p_body: body,
  });

  if (error) throw error;
  return ((data ?? []) as EventModeMessage[])[0] ?? null;
}

export async function reportEventModeMessage(messageId: string, reason?: string) {
  const { error } = await supabase.rpc("report_event_mode_message", {
    p_message_id: messageId,
    p_reason: cleanText(reason),
  });

  if (error) throw error;
}

export async function blockEventModeUser(eventId: string, blockedUserId: string) {
  const { error } = await supabase.rpc("block_event_mode_user", {
    p_event_id: eventId,
    p_blocked_user_id: blockedUserId,
  });

  if (error) throw error;
}
