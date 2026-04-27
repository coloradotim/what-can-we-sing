"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import type { Confidence, Part, Voicing } from "@/lib/matching";
import {
  addRepertoireItem,
  deleteRepertoireItem,
  getMyRepertoire,
  updateRepertoireItem,
  type RepertoireRow,
} from "@/lib/repertoireStore";
import { getCurrentUser, getMyProfile } from "@/lib/profileStore";

const voicings: Voicing[] = ["TTBB", "SATB", "SSAA"];

const partsByVoicing: Record<Voicing, Part[]> = {
  TTBB: ["Tenor", "Lead", "Baritone", "Bass"],
  SATB: ["Soprano", "Alto", "Tenor", "Bass"],
  SSAA: ["Soprano 1", "Soprano 2", "Alto 1", "Alto 2"],
};

const confidenceLevels: Confidence[] = [
  "Good to Go",
  "A Little Rusty",
  "Music Required",
];

type RepertoireForm = {
  songTitle: string;
  voicing: Voicing;
  arrangerName: string;
  partsKnown: Part[];
  confidence: Confidence;
};

function partAbbreviation(voicing: Voicing, part: Part): string {
  if (voicing === "TTBB") {
    if (part === "Tenor") return "T";
    if (part === "Lead") return "L";
    if (part === "Baritone") return "Bari";
    if (part === "Bass") return "Bs";
  }

  if (voicing === "SATB") {
    if (part === "Soprano") return "S";
    if (part === "Alto") return "A";
    if (part === "Tenor") return "T";
    if (part === "Bass") return "B";
  }

  if (part === "Soprano 1") return "S1";
  if (part === "Soprano 2") return "S2";
  if (part === "Alto 1") return "A1";
  if (part === "Alto 2") return "A2";

  return part;
}

export default function RepertoireManager() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RepertoireRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [voicing, setVoicing] = useState<Voicing | "">("");
  const [arrangerName, setArrangerName] = useState("");
  const [partsKnown, setPartsKnown] = useState<Part[]>([]);
  const [confidence, setConfidence] = useState<Confidence | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RepertoireForm | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadRepertoire() {
    setLoadError("");
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const data = await getMyRepertoire();
    setItems(data);
    setLoadError("");
  }

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const profile = await getMyProfile();
        if (!profile?.display_name) {
          window.location.href = "/settings";
          return;
        }

        const data = await getMyRepertoire();
        setItems(data);
      } catch (err) {
        console.error(err);
        setLoadError(
          "Could not load your repertoire. Check your connection and try again."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function togglePart(part: Part) {
    setPartsKnown((current) =>
      current.includes(part)
        ? current.filter((p) => p !== part)
        : [...current, part]
    );
  }

  function startEditing(item: RepertoireRow) {
    setEditingId(item.id);
    setEditForm({
      songTitle: item.song_title,
      voicing: item.voicing,
      arrangerName: item.arranger_name ?? "",
      partsKnown: item.parts_known,
      confidence: item.confidence,
    });
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  function toggleEditPart(part: Part) {
    setEditForm((current) => {
      if (!current) return current;

      return {
        ...current,
        partsKnown: current.partsKnown.includes(part)
          ? current.partsKnown.filter((p) => p !== part)
          : [...current.partsKnown, part],
      };
    });
  }

  function updateEditForm(patch: Partial<RepertoireForm>) {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  }

  async function addItem() {
    if (!songTitle.trim()) {
      setMessage("Add a song title before saving.");
      return;
    }

    if (!voicing) {
      setMessage("Choose a voicing before saving.");
      return;
    }

    if (!confidence) {
      setMessage("Choose a confidence level before saving.");
      return;
    }

    if (partsKnown.length === 0) {
      setMessage("Choose at least one part you know before saving.");
      return;
    }

    try {
      await addRepertoireItem({
        songTitle: songTitle.trim(),
        voicing,
        arrangerName: arrangerName.trim() || undefined,
        partsKnown,
        confidence,
      });

      setSongTitle("");
      setVoicing("");
      setArrangerName("");
      setPartsKnown([]);
      setConfidence("");
      setMessage("Song added.");

      await loadRepertoire();
    } catch (err) {
      console.error(err);
      setMessage("Could not add song. Check your connection and try again.");
    }
  }

  async function deleteItem(id: string) {
    try {
      await deleteRepertoireItem(id);
      if (editingId === id) {
        cancelEditing();
      }
      setMessage("Song deleted.");
      await loadRepertoire();
    } catch (err) {
      console.error(err);
      setMessage("Could not delete song. Check your connection and try again.");
    }
  }

  async function saveEdit(id: string) {
    if (!editForm) {
      return;
    }

    if (!editForm.songTitle.trim()) {
      setMessage("Add a song title before saving changes.");
      return;
    }

    if (editForm.partsKnown.length === 0) {
      setMessage("Choose at least one part you know before saving changes.");
      return;
    }

    try {
      await updateRepertoireItem(id, {
        songTitle: editForm.songTitle.trim(),
        voicing: editForm.voicing,
        arrangerName: editForm.arrangerName.trim() || undefined,
        partsKnown: editForm.partsKnown,
        confidence: editForm.confidence,
      });

      cancelEditing();
      setMessage("Song updated.");
      await loadRepertoire();
    } catch (err) {
      console.error(err);
      setMessage("Could not update song. Check your connection and try again.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading repertoire...
      </main>
    );
  }

  const canAddSong =
    Boolean(songTitle.trim()) &&
    Boolean(voicing) &&
    Boolean(confidence) &&
    partsKnown.length > 0;
  const visibleItems = items
    .filter((item) =>
      item.song_title.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
    .sort((a, b) =>
      a.song_title.localeCompare(b.song_title, undefined, {
        sensitivity: "base",
      })
    );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <AppNav />

        <h1 className="mt-4 text-4xl font-bold tracking-tight">My Repertoire</h1>
        <p className="mt-2 text-slate-300">
          Add songs you know, the parts you can sing, and how confident you are.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Your repertoire is stored so the app can find quartet matches.{" "}
          <a
            href="/privacy"
            className="font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Read privacy
          </a>
          .
        </p>

        {loadError && (
          <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={loadRepertoire}
              className="mt-3 rounded-xl bg-rose-100 px-4 py-2 font-semibold text-slate-950 hover:bg-white"
            >
              Try again
            </button>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg">
          <h2 className="text-2xl font-semibold">Add a song</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Song title</span>
              <input
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Arranger (optional)
              </span>
              <input
                value={arrangerName}
                onChange={(e) => setArrangerName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Voicing</span>
              <select
                value={voicing}
                onChange={(e) => {
                  setVoicing(e.target.value as Voicing | "");
                  setPartsKnown([]);
                }}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              >
                <option value="">Choose voicing</option>
                {voicings.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Confidence</span>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as Confidence | "")}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              >
                <option value="">Choose confidence</option>
                {confidenceLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-slate-300">Parts you know</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {voicing ? (
                partsByVoicing[voicing].map((part) => (
                  <button
                    key={part}
                    type="button"
                    onClick={() => togglePart(part)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      partsKnown.includes(part)
                        ? "bg-cyan-300 text-slate-950"
                        : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {part}
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-400">Choose a voicing first.</p>
              )}
            </div>
          </div>

          <button
            onClick={addItem}
            disabled={!canAddSong}
            className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            Add to repertoire
          </button>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Songs I know</h2>
              <p className="mt-1 text-sm text-slate-400">
                {items.length} {items.length === 1 ? "song" : "songs"} saved
              </p>
            </div>

            <label className="block sm:w-72">
              <span className="text-sm font-medium text-slate-300">
                Search by title
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {items.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                <p className="font-semibold text-white">No songs yet.</p>
                <p className="mt-1">
                  Add a song above with the part or parts you know. Your
                  repertoire is what powers quartet matches.
                </p>
              </div>
            )}

            {items.length > 0 && visibleItems.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No songs match that title.
              </div>
            )}

            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/10 shadow-lg"
              >
                {editingId === item.id && editForm ? (
                  <div className="w-full p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-slate-300">
                          Song title
                        </span>
                        <input
                          value={editForm.songTitle}
                          onChange={(e) =>
                            updateEditForm({ songTitle: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-slate-300">
                          Arranger (optional)
                        </span>
                        <input
                          value={editForm.arrangerName}
                          onChange={(e) =>
                            updateEditForm({ arrangerName: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-slate-300">
                          Voicing
                        </span>
                        <select
                          value={editForm.voicing}
                          onChange={(e) =>
                            updateEditForm({
                              voicing: e.target.value as Voicing,
                              partsKnown: [],
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        >
                          {voicings.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-slate-300">
                          Confidence
                        </span>
                        <select
                          value={editForm.confidence}
                          onChange={(e) =>
                            updateEditForm({
                              confidence: e.target.value as Confidence,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        >
                          {confidenceLevels.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-5">
                      <p className="text-sm font-medium text-slate-300">
                        Parts you know
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {partsByVoicing[editForm.voicing].map((part) => (
                          <button
                            key={part}
                            type="button"
                            onClick={() => toggleEditPart(part)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                              editForm.partsKnown.includes(part)
                                ? "bg-cyan-300 text-slate-950"
                                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            }`}
                          >
                            {part}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                      >
                        Save changes
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="rounded-xl bg-rose-400/10 px-5 py-3 font-semibold text-rose-200 hover:bg-rose-400/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">
                          {item.song_title}
                        </h3>
                        <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-slate-300">
                          {item.voicing}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
                        {item.parts_known.map((part) => (
                          <span
                            key={part}
                            className="rounded-full bg-cyan-300/10 px-2 py-0.5 font-semibold text-cyan-100 ring-1 ring-cyan-300/20"
                          >
                            {partAbbreviation(item.voicing, part)}
                          </span>
                        ))}
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 font-medium text-slate-300">
                          {item.confidence}
                        </span>
                        {item.arranger_name && (
                          <span className="truncate text-slate-400">
                            Arr. {item.arranger_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startEditing(item)}
                        className="rounded-lg bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="rounded-lg bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
