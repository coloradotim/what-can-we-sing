"use client";

import { AppNav } from "@/components/AppNav";
import {
  createEventModeEvent,
  eventModePathFromCode,
  findEventModeDuplicateCandidates,
  formatEventModeDateRange,
  getEventModeLifecycle,
  searchEventModeEvents,
  type EventModeDuplicateCandidate,
  type EventModeEvent,
  type EventModeVisibility,
} from "@/lib/eventMode";
import { getCurrentUser } from "@/lib/profileStore";
import { useEffect, useMemo, useState } from "react";

type EventFormState = {
  name: string;
  city: string;
  venueOrLocationNote: string;
  startAt: string;
  endAt: string;
  visibility: EventModeVisibility;
};

const emptyForm: EventFormState = {
  name: "",
  city: "",
  venueOrLocationNote: "",
  startAt: "",
  endAt: "",
  visibility: "listed",
};

function eventLocation(event: EventModeEvent) {
  return [event.city, event.venue_or_location_note].filter(Boolean).join(" · ");
}

function eventSummary(event: EventModeEvent) {
  const location = eventLocation(event);
  const dateRange = formatEventModeDateRange(event);
  return location ? `${location} · ${dateRange}` : dateRange;
}

export default function EventModePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [events, setEvents] = useState<EventModeEvent[]>([]);
  const [query, setQuery] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [duplicates, setDuplicates] = useState<EventModeDuplicateCandidate[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [creating, setCreating] = useState(false);

  async function loadEvents(searchQuery = query) {
    setLoadingEvents(true);
    try {
      const listedEvents = await searchEventModeEvents(searchQuery);
      setEvents(listedEvents);
    } catch (err) {
      console.error("Could not load Event Mode events", err);
      setMessageTone("error");
      setMessage("Could not load events. Check your connection and try again.");
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getCurrentUser();
        setSignedIn(Boolean(user));
        if (user) {
          const searchParams = new URLSearchParams(window.location.search);
          setShowCreateForm(searchParams.get("create") === "1");
          await loadEvents("");
        }
        setAuthChecked(true);
      } catch (err) {
        console.error("Could not check Event Mode access", err);
        setAuthChecked(true);
        setSignedIn(false);
      }
    }

    checkAuth();
  }, []);

  const visibleEvents = useMemo(() => events, [events]);

  function updateForm<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicates([]);
  }

  function goToCode() {
    const path = eventModePathFromCode(codeInput);
    if (!path) {
      setMessageTone("error");
      setMessage("Enter a valid Event Mode link or six-character code.");
      return;
    }

    window.location.href = path;
  }

  async function createEvent({ skipDuplicateCheck = false } = {}) {
    setCreating(true);
    setMessage("");

    try {
      if (!skipDuplicateCheck) {
        const duplicateSource = await searchEventModeEvents("");
        setEvents(duplicateSource);
        const possibleDuplicates = findEventModeDuplicateCandidates(
          form,
          duplicateSource
        );
        if (possibleDuplicates.length > 0) {
          setDuplicates(possibleDuplicates);
          setCreating(false);
          return;
        }
      }

      const event = await createEventModeEvent(form);
      setMessageTone("success");
      setMessage("Event created.");
      window.location.href = `/event-mode/${event.join_code}`;
    } catch (err) {
      console.error("Could not create Event Mode event", err);
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Could not create event.");
      setCreating(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <AppNav variant="public" />
          <p className="mt-8 text-sm font-semibold uppercase text-cyan-300">
            Event Mode Beta
          </p>
          <p className="mt-3 text-slate-300">Loading Event Mode...</p>
        </div>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <AppNav variant="public" />
          <p className="mt-10 text-sm font-semibold uppercase text-cyan-300">
            Event Mode Beta
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Find singers at an event
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            Event Mode helps singers find pickup singing opportunities at an
            event. Sign in to find or create an event.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Beta means this feature may be buggy or incomplete.
          </p>
          <a
            href="/login?redirect=/event-mode"
            className="mt-6 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Sign in
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <AppNav />

        <p className="mt-8 text-sm font-semibold uppercase text-cyan-300">
          Event Mode Beta
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Find singers at an event
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          Find singers at a convention, afterglow, Brigade weekend, or other
          singing event.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Event Mode is still in beta, so it may be buggy or incomplete. It is
          ready to try at events, and your feedback will help improve it.
        </p>

        {message && (
          <p
            className={`mt-4 text-sm ${
              messageTone === "success" ? "text-cyan-200" : "text-rose-200"
            }`}
          >
            {message}
          </p>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="text-sm font-semibold text-slate-200">
                  Find my event
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") loadEvents(query);
                  }}
                  placeholder="Search by event name, city, or shorthand like AHB"
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
              </label>
              <button
                type="button"
                onClick={() => loadEvents(query)}
                disabled={loadingEvents}
                className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50 sm:self-end"
              >
                {loadingEvents ? "Searching..." : "Find my event"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {visibleEvents.length === 0 && (
                <p className="rounded-xl bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                  No matching events found. Create one for your event, or check
                  the spelling, date, or location.
                </p>
              )}

              {visibleEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-xl border border-white/10 bg-slate-900/80 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {event.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-300">
                        {eventSummary(event)}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase text-cyan-200">
                        {getEventModeLifecycle(event)}
                      </p>
                    </div>
                    <a
                      href={`/event-mode/${event.join_code}`}
                      className="rounded-xl bg-cyan-300 px-4 py-2 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                    >
                      Use this event
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/10 p-5">
              <h2 className="text-xl font-bold">Enter with a link or code</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Use this for an unlisted event someone shared with you.
              </p>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-slate-200">
                  Event code or link
                </span>
                <input
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") goToCode();
                  }}
                  autoCapitalize="characters"
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
              </label>
              <button
                type="button"
                onClick={goToCode}
                className="mt-4 w-full rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-100 hover:bg-slate-700"
              >
                Use this event
              </button>
            </section>

            <section className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5">
              <h2 className="text-xl font-bold">Create an event</h2>
              <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                Create an event so singers using WCWS can find each other while
                they&apos;re there. Event Mode Beta is event-scoped and
                temporary; it does not create an official event listing.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateForm((current) => !current)}
                className="mt-4 w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
              >
                {showCreateForm ? "Hide event form" : "Create an event"}
              </button>
            </section>
          </aside>
        </div>

        {showCreateForm && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-5">
            <h2 className="text-2xl font-bold">Create an event</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-200">
                  Event name
                </span>
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-200">
                  City or location note
                </span>
                <input
                  value={form.city}
                  onChange={(event) => updateForm("city", event.target.value)}
                  placeholder="Denver, CO"
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-200">
                  Venue or room note
                </span>
                <input
                  value={form.venueOrLocationNote}
                  onChange={(event) =>
                    updateForm("venueOrLocationNote", event.target.value)
                  }
                  placeholder="Hotel lobby, afterglow, hospitality room"
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
                  onChange={(event) => updateForm("startAt", event.target.value)}
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
                  onChange={(event) => updateForm("endAt", event.target.value)}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-slate-200">
                Visibility
              </legend>
              <p className="mt-1 text-sm text-slate-300">
                Listed events can be found by other signed-in WCWS users.
                Unlisted events require a link or code.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["listed", "unlisted"] as const).map((visibility) => (
                  <label
                    key={visibility}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3"
                  >
                    <input
                      type="radio"
                      name="visibility"
                      checked={form.visibility === visibility}
                      onChange={() => updateForm("visibility", visibility)}
                    />
                    <span className="font-semibold capitalize">{visibility}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {duplicates.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
                <h3 className="text-lg font-bold text-amber-100">
                  This might already exist
                </h3>
                <div className="mt-3 space-y-3">
                  {duplicates.map((candidate) => (
                    <div
                      key={candidate.event.id}
                      className="rounded-xl bg-slate-950/50 p-4"
                    >
                      <p className="font-semibold text-white">
                        {candidate.event.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {eventSummary(candidate.event)}
                      </p>
                      <p className="mt-1 text-xs text-amber-100">
                        Similar because of {candidate.reasons.join(", ")}.
                      </p>
                      <a
                        href={`/event-mode/${candidate.event.join_code}`}
                        className="mt-3 inline-block rounded-xl bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-100"
                      >
                        Use existing event
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => createEvent()}
                disabled={creating}
                className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create an event"}
              </button>
              {duplicates.length > 0 && (
                <button
                  type="button"
                  onClick={() => createEvent({ skipDuplicateCheck: true })}
                  disabled={creating}
                  className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                >
                  Create new event anyway
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
