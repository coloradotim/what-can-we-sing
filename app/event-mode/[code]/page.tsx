"use client";

import { AppNav } from "@/components/AppNav";
import {
  closeEventModeEvent,
  formatEventModeDateRange,
  getEventModeEventByCode,
  getEventModeLifecycle,
  updateEventModeEvent,
  type EventModeEvent,
  type EventModeVisibility,
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

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
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

export default function EventModeDetailPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const [event, setEvent] = useState<EventModeEvent | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [form, setForm] = useState<EventFormState | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");

  useEffect(() => {
    async function loadEvent() {
      try {
        const [loadedEvent, user] = await Promise.all([
          getEventModeEventByCode(code),
          getCurrentUser().catch(() => null),
        ]);
        setEvent(loadedEvent);
        setForm(loadedEvent ? formFromEvent(loadedEvent) : null);
        setCurrentUserId(user?.id ?? null);
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

  function updateForm<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K]
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
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
              Event Mode
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
                <a
                  href={`/login?redirect=/event-mode/${event.join_code}`}
                  className="mt-4 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
                >
                  Sign in
                </a>
              </section>
            )}

            {currentUserId && (
              <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5">
                <h2 className="text-2xl font-bold">Use this event</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  This event is ready for Event Mode. Availability and messaging
                  arrive in follow-up work. For now, use this event as the shared
                  place singers can find before starting a quartet.
                </p>
                <a
                  href="/session"
                  className="mt-4 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
                >
                  Start a quartet
                </a>
              </section>
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
