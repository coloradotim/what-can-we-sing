"use client";

import { AppNav } from "@/components/AppNav";
import { trackEvent } from "@/lib/analytics";
import {
  blockEventModeUser,
  closeEventModeEvent,
  defaultEventModeAvailableUntil,
  eventModeVoicePartGroups,
  eventModeVoicePartOptions,
  filterEventModeAvailabilityByPart,
  formatEventModeVoicePart,
  formatEventModeVoiceParts,
  formatEventModeDateRange,
  getEventModeAvailabilityByCode,
  getEventModeEventByCode,
  getEventModeMessagesByCode,
  getEventModeLifecycle,
  notifyEventModeMessage,
  reportEventModeMessage,
  sendEventModeMessage,
  turnOffEventModeAvailability,
  updateEventModeEvent,
  upsertEventModeAvailability,
  type EventModeAvailability,
  type EventModeEvent,
  type EventModeMessage,
  type EventModeVisibility,
  type EventModeVoicePart,
} from "@/lib/eventMode";
import { getCurrentUser } from "@/lib/profileStore";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type EventFormState = {
  name: string;
  city: string;
  venueOrLocationNote: string;
  startAt: string;
  endAt: string;
  visibility: EventModeVisibility;
};

type AvailabilityFormState = {
  voiceParts: EventModeVoicePart[];
  availabilityNote: string;
  meetupNote: string;
  availableUntil: string;
};

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function availabilityFormFromEvent(
  event: EventModeEvent,
  availability?: EventModeAvailability | null
): AvailabilityFormState {
  return {
    voiceParts: availability?.voice_parts ?? [],
    availabilityNote: availability?.availability_note ?? "",
    meetupNote: availability?.meetup_note ?? "",
    availableUntil: toLocalDateTimeValue(
      availability?.available_until ?? defaultEventModeAvailableUntil(event)
    ),
  };
}

function formFromEvent(event: EventModeEvent): EventFormState {
  return {
    name: event.name,
    city: event.city ?? "",
    venueOrLocationNote: event.venue_or_location_note ?? "",
    startAt: toLocalDateTimeValue(event.start_at),
    endAt: toLocalDateTimeValue(event.end_at),
    visibility: event.visibility,
  };
}

function eventLocation(event: EventModeEvent) {
  return [event.city, event.venue_or_location_note].filter(Boolean).join(" · ");
}

function availabilityAnalyticsProperties(
  availabilityForm: AvailabilityFormState
) {
  return {
    selected_voice_part_count: availabilityForm.voiceParts.length,
    has_availability: availabilityForm.availabilityNote.trim().length > 0,
    has_meetup: availabilityForm.meetupNote.trim().length > 0,
  };
}

export default function EventModeDetailPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const [event, setEvent] = useState<EventModeEvent | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [turningOffAvailability, setTurningOffAvailability] = useState(false);
  const [form, setForm] = useState<EventFormState | null>(null);
  const [availabilityForm, setAvailabilityForm] =
    useState<AvailabilityFormState | null>(null);
  const [availability, setAvailability] = useState<EventModeAvailability[]>([]);
  const [messages, setMessages] = useState<EventModeMessage[]>([]);
  const [selectedPart, setSelectedPart] = useState<EventModeVoicePart | "all">(
    "all"
  );
  const [messageTarget, setMessageTarget] =
    useState<EventModeAvailability | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [busyMessageKey, setBusyMessageKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");

  useEffect(() => {
    async function loadEvent() {
      try {
        const [loadedEvent, user] = await Promise.all([
          getEventModeEventByCode(code),
          getCurrentUser().catch(() => null),
        ]);
        let loadedAvailability: EventModeAvailability[] = [];
        let loadedMessages: EventModeMessage[] = [];
        if (loadedEvent && user) {
          [loadedAvailability, loadedMessages] = await Promise.all([
            getEventModeAvailabilityByCode(code),
            getEventModeMessagesByCode(code),
          ]);
        }
        setEvent(loadedEvent);
        setForm(loadedEvent ? formFromEvent(loadedEvent) : null);
        setCurrentUserId(user?.id ?? null);
        setAvailability(loadedAvailability);
        setMessages(loadedMessages);
        const myAvailability = loadedAvailability.find(
          (item) => item.user_id === user?.id
        );
        setAvailabilityForm(
          loadedEvent ? availabilityFormFromEvent(loadedEvent, myAvailability) : null
        );
        if (loadedEvent) {
          trackEvent("event_mode_viewed", {
            page_area: "detail",
            signed_in: Boolean(user),
            visibility: loadedEvent.visibility,
            lifecycle: getEventModeLifecycle(loadedEvent),
            availability_count: loadedAvailability.length,
            message_count: loadedMessages.length,
          });
        }
      } catch (err) {
        console.error("Could not load Event Mode event", err);
        setMessageTone("error");
        setMessage("Could not load this event. Check the link or code.");
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [code]);

  const isCreator = Boolean(
    event && currentUserId && event.created_by_user_id === currentUserId
  );
  const lifecycle = event ? getEventModeLifecycle(event) : null;
  const currentAvailability = availability.find(
    (item) => item.user_id === currentUserId
  );
  const visibleAvailability = filterEventModeAvailabilityByPart(
    availability,
    selectedPart
  );

  function updateForm<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K]
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateAvailabilityForm<K extends keyof AvailabilityFormState>(
    key: K,
    value: AvailabilityFormState[K]
  ) {
    setAvailabilityForm((current) =>
      current ? { ...current, [key]: value } : current
    );
  }

  function toggleAvailabilityPart(part: EventModeVoicePart) {
    setAvailabilityForm((current) => {
      if (!current) return current;
      const selected = new Set(current.voiceParts);
      if (selected.has(part)) selected.delete(part);
      else selected.add(part);
      return { ...current, voiceParts: Array.from(selected) };
    });
  }

  async function reloadAvailability() {
    const loadedAvailability = await getEventModeAvailabilityByCode(code);
    setAvailability(loadedAvailability);
    const myAvailability = loadedAvailability.find(
      (item) => item.user_id === currentUserId
    );
    if (event) {
      setAvailabilityForm(availabilityFormFromEvent(event, myAvailability));
    }
  }

  async function reloadMessages() {
    const loadedMessages = await getEventModeMessagesByCode(code);
    setMessages(loadedMessages);
  }

  async function saveEvent() {
    if (!event || !form) return;
    setSaving(true);
    setMessage("");

    try {
      const updated = await updateEventModeEvent(event.id, form);
      setEvent(updated);
      setForm(formFromEvent(updated));
      setEditing(false);
      setMessageTone("success");
      setMessage("Event updated.");
    } catch (err) {
      console.error("Could not update Event Mode event", err);
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Could not update event.");
    } finally {
      setSaving(false);
    }
  }

  async function closeEvent() {
    if (!event) return;
    setClosing(true);
    setMessage("");

    try {
      const updated = await closeEventModeEvent(event.id);
      setEvent(updated);
      setForm(formFromEvent(updated));
      setEditing(false);
      setMessageTone("success");
      setMessage("Event closed.");
    } catch (err) {
      console.error("Could not close Event Mode event", err);
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Could not close event.");
    } finally {
      setClosing(false);
    }
  }

  async function saveAvailability() {
    if (!event || !availabilityForm) return;
    setSavingAvailability(true);
    setMessage("");

    try {
      const wasAvailable = Boolean(currentAvailability);
      await upsertEventModeAvailability({
        eventId: event.id,
        voiceParts: availabilityForm.voiceParts,
        availabilityNote: availabilityForm.availabilityNote,
        meetupNote: availabilityForm.meetupNote,
        availableUntil: availabilityForm.availableUntil,
      });
      trackEvent(
        wasAvailable
          ? "event_mode_availability_updated"
          : "event_mode_availability_created",
        {
          ...availabilityAnalyticsProperties(availabilityForm),
          visibility: event.visibility,
          lifecycle: getEventModeLifecycle(event),
          status: "success",
        }
      );
      await reloadAvailability();
      setMessageTone("success");
      setMessage("You are available to sing at this event.");
    } catch (err) {
      console.error("Could not save Event Mode availability", err);
      trackEvent(
        currentAvailability
          ? "event_mode_availability_updated"
          : "event_mode_availability_created",
        {
          ...availabilityAnalyticsProperties(availabilityForm),
          visibility: event.visibility,
          lifecycle: getEventModeLifecycle(event),
          status: "failure",
        }
      );
      setMessageTone("error");
      setMessage(
        err instanceof Error ? err.message : "Could not save availability."
      );
    } finally {
      setSavingAvailability(false);
    }
  }

  async function turnOffAvailability() {
    if (!event) return;
    setTurningOffAvailability(true);
    setMessage("");

    try {
      await turnOffEventModeAvailability(event.id);
      trackEvent("event_mode_availability_turned_off", {
        visibility: event.visibility,
        lifecycle: getEventModeLifecycle(event),
        status: "success",
      });
      await reloadAvailability();
      setMessageTone("success");
      setMessage("Your Event Mode availability is turned off.");
    } catch (err) {
      console.error("Could not turn off Event Mode availability", err);
      trackEvent("event_mode_availability_turned_off", {
        visibility: event.visibility,
        lifecycle: getEventModeLifecycle(event),
        status: "failure",
      });
      setMessageTone("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Could not turn off availability."
      );
    } finally {
      setTurningOffAvailability(false);
    }
  }

  async function sendMessageToAvailability(target: EventModeAvailability) {
    if (!event) return;
    setBusyMessageKey(`send-${target.user_id}`);
    setMessage("");

    try {
      const sentMessage = await sendEventModeMessage({
        eventId: event.id,
        recipientUserId: target.user_id,
        recipientAvailabilityId: target.id,
        body: messageBody,
      });
      trackEvent("event_mode_message_sent", {
        visibility: event.visibility,
        lifecycle: getEventModeLifecycle(event),
        status: "success",
        notification_attempted: Boolean(sentMessage),
      });
      let notificationSent = true;
      if (sentMessage) {
        await notifyEventModeMessage(sentMessage.id).catch((err) => {
          notificationSent = false;
          console.error("Could not send Event Mode message notification", err);
        });
      }
      setMessageTarget(null);
      setMessageBody("");
      await reloadMessages();
      setMessageTone("success");
      setMessage(
        notificationSent
          ? "Message sent."
          : "Message sent. Email notification was not sent."
      );
    } catch (err) {
      console.error("Could not send Event Mode message", err);
      trackEvent("event_mode_message_sent", {
        visibility: event.visibility,
        lifecycle: getEventModeLifecycle(event),
        status: "failure",
      });
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setBusyMessageKey(null);
    }
  }

  async function sendReply(recipientUserId: string) {
    if (!event) return;
    const body = replyBodies[recipientUserId] ?? "";
    setBusyMessageKey(`reply-${recipientUserId}`);
    setMessage("");

    try {
      const sentMessage = await sendEventModeMessage({
        eventId: event.id,
        recipientUserId,
        body,
      });
      trackEvent("event_mode_message_replied", {
        visibility: event.visibility,
        lifecycle: getEventModeLifecycle(event),
        status: "success",
        notification_attempted: Boolean(sentMessage),
      });
      let notificationSent = true;
      if (sentMessage) {
        await notifyEventModeMessage(sentMessage.id).catch((err) => {
          notificationSent = false;
          console.error("Could not send Event Mode reply notification", err);
        });
      }
      setReplyBodies((current) => ({ ...current, [recipientUserId]: "" }));
      await reloadMessages();
      setMessageTone("success");
      setMessage(
        notificationSent
          ? "Reply sent."
          : "Reply sent. Email notification was not sent."
      );
    } catch (err) {
      console.error("Could not send Event Mode reply", err);
      trackEvent("event_mode_message_replied", {
        visibility: event.visibility,
        lifecycle: getEventModeLifecycle(event),
        status: "failure",
      });
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setBusyMessageKey(null);
    }
  }

  async function reportMessage(item: EventModeMessage) {
    setBusyMessageKey(`report-${item.id}`);
    setMessage("");

    try {
      await reportEventModeMessage(item.id);
      await reloadMessages();
      setMessageTone("success");
      setMessage("Message reported.");
    } catch (err) {
      console.error("Could not report Event Mode message", err);
      setMessageTone("error");
      setMessage(
        err instanceof Error ? err.message : "Could not report message."
      );
    } finally {
      setBusyMessageKey(null);
    }
  }

  async function blockUser(blockedUserId: string) {
    if (!event) return;
    setBusyMessageKey(`block-${blockedUserId}`);
    setMessage("");

    try {
      await blockEventModeUser(event.id, blockedUserId);
      await reloadMessages();
      setMessageTone("success");
      setMessage("That singer can no longer message you for this event.");
    } catch (err) {
      console.error("Could not block Event Mode user", err);
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Could not block user.");
    } finally {
      setBusyMessageKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <AppNav variant={currentUserId ? "app" : "public"} />

        {loading && <p className="mt-8 text-slate-300">Loading event...</p>}

        {!loading && !event && (
          <section className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-5">
            <h1 className="text-2xl font-bold">Event not found</h1>
            <p className="mt-2 text-rose-100">
              Check the Event Mode code or ask the singer who shared it.
            </p>
            <a
              href="/event-mode"
              className="mt-4 inline-block rounded-xl bg-rose-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white"
            >
              Find my event
            </a>
          </section>
        )}

        {event && (
          <>
            <p className="mt-8 text-sm font-semibold uppercase text-cyan-300">
              Event Mode Beta
            </p>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">
                  {event.name}
                </h1>
                <p className="mt-3 text-lg text-slate-300">
                  {[eventLocation(event), formatEventModeDateRange(event)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2 text-sm font-semibold uppercase text-cyan-200">
                  {lifecycle} · {event.visibility}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Event Mode is still in beta, so it may be buggy or incomplete.
                  It is ready to try at events, and your feedback will help
                  improve it.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">Event code</p>
                <p className="mt-1 text-2xl font-bold tracking-widest text-cyan-200">
                  {event.join_code}
                </p>
              </div>
            </div>

            {message && (
              <p
                className={`mt-4 text-sm ${
                  messageTone === "success" ? "text-cyan-200" : "text-rose-200"
                }`}
              >
                {message}
              </p>
            )}

            {!currentUserId && (
              <section className="mt-8 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5">
                <h2 className="text-xl font-bold">Sign in to use this event</h2>
                <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                  Event Mode helps singers find pickup singing opportunities at
                  an event. Sign in to use this event.
                </p>
                <p className="mt-2 text-sm leading-6 text-cyan-50/70">
                  Beta means this feature may be buggy or incomplete.
                </p>
                <a
                  href={`/login?redirect=/event-mode/${event.join_code}`}
                  className="mt-4 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
                >
                  Sign in
                </a>
              </section>
            )}

            {currentUserId && (
              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                <section className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5">
                  <h2 className="text-2xl font-bold">
                    I&apos;m available to sing
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                    This is only shown for this event. Your availability expires
                    automatically.
                  </p>
                  {!currentAvailability && (
                    <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                      Want to sing at this event? Make yourself available and
                      add a short note about when and where to find you.
                    </p>
                  )}

                  {availabilityForm && (
                    <div className="mt-5 space-y-5">
                      <fieldset>
                        <legend className="text-sm font-semibold text-slate-100">
                          Voice part(s)
                        </legend>
                        <div className="mt-3 space-y-3">
                          {eventModeVoicePartGroups.map((group) => (
                            <div
                              key={group.voicing}
                              className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
                            >
                              <p className="text-xs font-bold uppercase text-cyan-200">
                                {group.label}
                              </p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {group.parts.map((part) => (
                                  <label
                                    key={part}
                                    className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={availabilityForm.voiceParts.includes(
                                        part
                                      )}
                                      onChange={() => toggleAvailabilityPart(part)}
                                    />
                                    <span>{formatEventModeVoicePart(part)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </fieldset>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-100">
                          When are you available at this event?
                        </span>
                        <input
                          value={availabilityForm.availabilityNote}
                          onChange={(inputEvent) =>
                            updateAvailabilityForm(
                              "availabilityNote",
                              inputEvent.target.value
                            )
                          }
                          placeholder="After chorus contest"
                          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-100">
                          Where should people find you at this event?
                        </span>
                        <input
                          value={availabilityForm.meetupNote}
                          onChange={(inputEvent) =>
                            updateAvailabilityForm(
                              "meetupNote",
                              inputEvent.target.value
                            )
                          }
                          placeholder="Lobby near registration"
                          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-100">
                          Available until
                        </span>
                        <input
                          type="datetime-local"
                          value={availabilityForm.availableUntil}
                          onChange={(inputEvent) =>
                            updateAvailabilityForm(
                              "availableUntil",
                              inputEvent.target.value
                            )
                          }
                          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        />
                      </label>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={saveAvailability}
                          disabled={savingAvailability}
                          className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
                        >
                          {savingAvailability
                            ? "Saving..."
                            : "I\u2019m available to sing"}
                        </button>
                        {currentAvailability && (
                          <button
                            type="button"
                            onClick={turnOffAvailability}
                            disabled={turningOffAvailability}
                            className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                          >
                            {turningOffAvailability
                              ? "Turning off..."
                              : "Turn off my availability"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">Available singers</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Event Mode shows only what singers choose to share for
                        this event.
                      </p>
                    </div>
                    <label className="block min-w-48">
                      <span className="text-sm font-semibold text-slate-200">
                        Filter by voice part
                      </span>
                      <select
                        value={selectedPart}
                        onChange={(inputEvent) => {
                          const value = inputEvent.target.value as
                            | EventModeVoicePart
                            | "all";
                          setSelectedPart(value);
                          trackEvent(
                            "event_mode_available_singer_filter_used",
                            {
                              selected_part_count: value === "all" ? 0 : 1,
                              availability_count: availability.length,
                              visibility: event.visibility,
                              lifecycle: getEventModeLifecycle(event),
                            }
                          );
                        }}
                        className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-white outline-none ring-cyan-300 focus:ring-2"
                      >
                        <option value="all">All parts</option>
                        {eventModeVoicePartOptions.map((part) => (
                          <option key={part} value={part}>
                            {formatEventModeVoicePart(part)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 space-y-3">
                    {visibleAvailability.length === 0 && (
                      <p className="rounded-xl bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                        {selectedPart === "all"
                          ? "No one is available yet. Make yourself available so other singers know you want to sing."
                          : "No active available singers match this filter yet."}
                      </p>
                    )}

                    {visibleAvailability.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-slate-900/80 p-4"
                      >
                        <h3 className="text-lg font-bold text-white">
                          {item.display_name}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-cyan-200">
                          {formatEventModeVoiceParts(item.voice_parts)}
                        </p>
                        {item.availability_note && (
                          <p className="mt-3 text-sm text-slate-200">
                            {item.availability_note}
                          </p>
                        )}
                        {item.meetup_note && (
                          <p className="mt-1 text-sm text-slate-300">
                            {item.meetup_note}
                          </p>
                        )}
                        {item.user_id !== currentUserId && (
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => {
                                setMessageTarget(item);
                                setMessageBody("");
                                trackEvent("event_mode_message_started", {
                                  visibility: event.visibility,
                                  lifecycle: getEventModeLifecycle(event),
                                  availability_count: availability.length,
                                });
                              }}
                              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                            >
                              Message
                            </button>

                            {messageTarget?.id === item.id && (
                              <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3">
                                <label className="block">
                                  <span className="text-sm font-semibold text-white">
                                    Message {item.display_name}
                                  </span>
                                  <span className="mt-1 block text-xs leading-5 text-cyan-50/80">
                                    Send a note to coordinate singing at this
                                    event. Your email address is not shown.
                                  </span>
                                  <textarea
                                    value={messageBody}
                                    onChange={(inputEvent) =>
                                      setMessageBody(inputEvent.target.value)
                                    }
                                    rows={3}
                                    maxLength={1000}
                                    className="mt-2 w-full rounded-xl bg-slate-950 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                                  />
                                </label>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <button
                                    type="button"
                                    onClick={() => sendMessageToAvailability(item)}
                                    disabled={busyMessageKey === `send-${item.user_id}`}
                                    className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
                                  >
                                    {busyMessageKey === `send-${item.user_id}`
                                      ? "Sending..."
                                      : "Send message"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMessageTarget(null);
                                      setMessageBody("");
                                    }}
                                    className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/50 p-4">
                    <h3 className="text-lg font-bold text-white">Messages</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Event Mode messages are private to the sender and
                      recipient for this event.
                    </p>

                    <div className="mt-4 space-y-3">
                      {messages.length === 0 && (
                        <p className="rounded-xl bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                          No messages for this event yet.
                        </p>
                      )}

                      {messages.map((item) => {
                        const sentByMe = item.sender_user_id === currentUserId;
                        const otherUserId = sentByMe
                          ? item.recipient_user_id
                          : item.sender_user_id;
                        const otherName = sentByMe
                          ? item.recipient_display_name
                          : item.sender_display_name;
                        const replyBody = replyBodies[otherUserId] ?? "";

                        return (
                          <article
                            key={item.id}
                            className="rounded-xl border border-white/10 bg-slate-900/80 p-4"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-cyan-200">
                                  {sentByMe
                                    ? `You messaged ${item.recipient_display_name}`
                                    : `${item.sender_display_name} messaged you`}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {new Date(item.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => reportMessage(item)}
                                  disabled={
                                    item.reported_by_me ||
                                    busyMessageKey === `report-${item.id}`
                                  }
                                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                                >
                                  {item.reported_by_me ? "Reported" : "Report"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => blockUser(otherUserId)}
                                  disabled={
                                    item.blocked_by_me ||
                                    busyMessageKey === `block-${otherUserId}`
                                  }
                                  className="rounded-lg bg-rose-200 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-rose-100 disabled:opacity-50"
                                >
                                  {item.blocked_by_me ? "Blocked" : "Block"}
                                </button>
                              </div>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">
                              {item.body}
                            </p>

                            {!item.blocked_by_me && (
                              <div className="mt-4 rounded-xl bg-white/5 p-3">
                                <label className="block">
                                  <span className="text-sm font-semibold text-slate-100">
                                    Reply to {otherName}
                                  </span>
                                  <textarea
                                    value={replyBody}
                                    onChange={(inputEvent) =>
                                      setReplyBodies((current) => ({
                                        ...current,
                                        [otherUserId]: inputEvent.target.value,
                                      }))
                                    }
                                    rows={2}
                                    maxLength={1000}
                                    className="mt-2 w-full rounded-xl bg-slate-950 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => sendReply(otherUserId)}
                                  disabled={busyMessageKey === `reply-${otherUserId}`}
                                  className="mt-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
                                >
                                  {busyMessageKey === `reply-${otherUserId}`
                                    ? "Sending..."
                                    : "Reply"}
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-4">
                    <p className="font-semibold text-white">
                      Found people to sing with?
                    </p>
                    <p className="mt-1 text-sm leading-6 text-cyan-50/80">
                      Start a quartet and have the others join by QR code or
                      link.
                    </p>
                    <a
                      href="/session"
                      onClick={() =>
                        trackEvent("event_mode_start_quartet_clicked", {
                          visibility: event.visibility,
                          lifecycle: getEventModeLifecycle(event),
                          availability_count: availability.length,
                          message_count: messages.length,
                        })
                      }
                      className="mt-3 inline-block rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                    >
                      Start a quartet
                    </a>
                  </div>
                </section>
              </div>
            )}

            {isCreator && form && (
              <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Event settings</h2>
                    <p className="mt-1 text-sm text-slate-300">
                      Event creators can edit details or close the event.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing((current) => !current)}
                    className="rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    {editing ? "Cancel editing" : "Edit event"}
                  </button>
                </div>

                {editing && (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="md:col-span-2">
                      <span className="text-sm font-semibold text-slate-200">
                        Event name
                      </span>
                      <input
                        value={form.name}
                        onChange={(inputEvent) =>
                          updateForm("name", inputEvent.target.value)
                        }
                        className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold text-slate-200">
                        City or location note
                      </span>
                      <input
                        value={form.city}
                        onChange={(inputEvent) =>
                          updateForm("city", inputEvent.target.value)
                        }
                        className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold text-slate-200">
                        Venue or room note
                      </span>
                      <input
                        value={form.venueOrLocationNote}
                        onChange={(inputEvent) =>
                          updateForm(
                            "venueOrLocationNote",
                            inputEvent.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold text-slate-200">
                        Start date/time
                      </span>
                      <input
                        type="datetime-local"
                        value={form.startAt}
                        onChange={(inputEvent) =>
                          updateForm("startAt", inputEvent.target.value)
                        }
                        className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold text-slate-200">
                        End date/time
                      </span>
                      <input
                        type="datetime-local"
                        value={form.endAt}
                        onChange={(inputEvent) =>
                          updateForm("endAt", inputEvent.target.value)
                        }
                        className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                      />
                    </label>
                    <fieldset className="md:col-span-2">
                      <legend className="text-sm font-semibold text-slate-200">
                        Visibility
                      </legend>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {(["listed", "unlisted"] as const).map((visibility) => (
                          <label
                            key={visibility}
                            className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3"
                          >
                            <input
                              type="radio"
                              name="detail-visibility"
                              checked={form.visibility === visibility}
                              onChange={() => updateForm("visibility", visibility)}
                            />
                            <span className="font-semibold capitalize">
                              {visibility}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
                      <button
                        type="button"
                        onClick={saveEvent}
                        disabled={saving}
                        className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save event"}
                      </button>
                      {!event.closed_at && (
                        <button
                          type="button"
                          onClick={closeEvent}
                          disabled={closing}
                          className="rounded-xl bg-rose-200 px-5 py-3 font-semibold text-slate-950 hover:bg-rose-100 disabled:opacity-50"
                        >
                          {closing ? "Closing..." : "Close event"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
