"use client";

import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";
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
  "Performance ready",
  "Solid",
  "Needs review",
  "Rusty",
  "Learning",
];

type RepertoireForm = {
  songTitle: string;
  voicing: Voicing;
  arrangerName: string;
  partsKnown: Part[];
  confidence: Confidence;
};

export default function RepertoireManager() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RepertoireRow[]>([]);
  const [songTitle, setSongTitle] = useState("");
  const [voicing, setVoicing] = useState<Voicing>("TTBB");
  const [arrangerName, setArrangerName] = useState("");
  const [partsKnown, setPartsKnown] = useState<Part[]>([]);
  const [confidence, setConfidence] = useState<Confidence>("Solid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RepertoireForm | null>(null);
  const [message, setMessage] = useState("");

  async function loadRepertoire() {
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const data = await getMyRepertoire();
    setItems(data);
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
        setMessage("Could not load repertoire.");
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
    if (!songTitle.trim() || partsKnown.length === 0) return;

    try {
      await addRepertoireItem({
        songTitle: songTitle.trim(),
        voicing,
        arrangerName: arrangerName.trim() || undefined,
        partsKnown,
        confidence,
      });

      setSongTitle("");
      setArrangerName("");
      setPartsKnown([]);
      setConfidence("Solid");
      setMessage("Song added.");

      await loadRepertoire();
    } catch (err) {
      console.error(err);
      setMessage("Could not add song.");
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
      setMessage("Could not delete song.");
    }
  }

  async function saveEdit(id: string) {
    if (!editForm || !editForm.songTitle.trim() || editForm.partsKnown.length === 0) {
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
      setMessage("Could not update song.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading repertoire...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-4">
          <a href="/session" className="text-sm text-cyan-300 hover:text-cyan-200">
            → Start a quartet
          </a>
          <a href="/settings" className="text-sm text-cyan-300 hover:text-cyan-200">
            → Settings
          </a>
          <SignOutButton />
        </div>

        <h1 className="mt-4 text-4xl font-bold tracking-tight">My Repertoire</h1>
        <p className="mt-2 text-slate-300">
          Add songs you know, the parts you can sing, and how confident you are.
        </p>

        {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg">
          <h2 className="text-2xl font-semibold">Add a song</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Song title</span>
              <input
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="Hello Mary Lou"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Arranger optional
              </span>
              <input
                value={arrangerName}
                onChange={(e) => setArrangerName(e.target.value)}
                placeholder="Unknown is okay"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Voicing</span>
              <select
                value={voicing}
                onChange={(e) => {
                  setVoicing(e.target.value as Voicing);
                  setPartsKnown([]);
                }}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
              >
                {voicings.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Confidence</span>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as Confidence)}
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
            <p className="text-sm font-medium text-slate-300">Parts you know</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {partsByVoicing[voicing].map((part) => (
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
              ))}
            </div>
          </div>

          <button
            onClick={addItem}
            className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
            disabled={!songTitle.trim() || partsKnown.length === 0}
          >
            Add to repertoire
          </button>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Songs I know</h2>

          <div className="mt-4 space-y-3">
            {items.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                No songs yet. Add your first one above.
              </p>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg md:flex-row md:items-center"
              >
                {editingId === item.id && editForm ? (
                  <div className="w-full">
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
                          Arranger optional
                        </span>
                        <input
                          value={editForm.arrangerName}
                          onChange={(e) =>
                            updateEditForm({ arrangerName: e.target.value })
                          }
                          placeholder="Unknown is okay"
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
                        disabled={
                          !editForm.songTitle.trim() ||
                          editForm.partsKnown.length === 0
                        }
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
                  <>
                    <div>
                      <h3 className="text-xl font-semibold">
                        {item.song_title} — {item.voicing}
                      </h3>
                      <p className="mt-1 text-sm text-slate-300">
                        {item.arranger_name
                          ? `Arr. ${item.arranger_name}`
                          : "Arranger unknown"}
                      </p>
                      <p className="mt-2 text-sm text-slate-200">
                        Parts: {item.parts_known.join(", ")}
                      </p>
                      <p className="text-sm text-slate-300">
                        Confidence: {item.confidence}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                      <button
                        onClick={() => startEditing(item)}
                        className="rounded-xl bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="rounded-xl bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/20"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
