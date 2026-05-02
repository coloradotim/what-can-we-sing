"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import type { Confidence, Part, Voicing } from "@/lib/matching";
import { arrangerDisplayName } from "@/lib/arrangerDisplay";
import { partButtonLabel } from "@/lib/partAbbreviations";
import { getCurrentUser } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import {
  copySharedSongsToMyRepertoire,
  getSharedRepertoire,
  resolveSharedSongCopyability,
  type CopyableSharedSong,
  type SharedRepertoire,
  type SharedRepertoireSong,
} from "@/lib/repertoireSharing";

const confidenceLevels: Confidence[] = [
  "Good to Go",
  "A Little Rusty",
  "Music Required",
];

const partsByVoicing: Record<Voicing, Part[]> = {
  TTBB: ["Tenor", "Lead", "Baritone", "Bass"],
  SATB: ["Soprano", "Alto", "Tenor", "Bass"],
  SSAA: ["Soprano 1", "Soprano 2", "Alto 1", "Alto 2"],
};

type SelectionByVoicing = Partial<
  Record<Voicing, { part: Part | ""; confidence: Confidence | "" }>
>;

function duplicateLabel(status: CopyableSharedSong["duplicateStatus"]) {
  if (status === "exact") return "Already in My Songs";
  if (status === "possible_arrangement") return "Possible different arrangement";
  return null;
}

export function SharedRepertoireManager({ code }: { code: string }) {
  const normalizedCode = code.toUpperCase();
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<SharedRepertoire | null>(null);
  const [songs, setSongs] = useState<CopyableSharedSong[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [selectionsByVoicing, setSelectionsByVoicing] =
    useState<SelectionByVoicing>({});
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setMessage("");

        const sharedRepertoire = await getSharedRepertoire(normalizedCode);
        setShare(sharedRepertoire);

        const user = await getCurrentUser();
        setIsSignedIn(Boolean(user));

        if (!sharedRepertoire) {
          setSongs([]);
          setSelectedSongIds(new Set());
          return;
        }

        if (!user) {
          const anonymousSongs = resolveSharedSongCopyability(
            sharedRepertoire.songs,
            []
          );
          setSongs(anonymousSongs);
          setSelectedSongIds(new Set());
          return;
        }

        const myRepertoire = await getMyRepertoire();
        const resolvedSongs = resolveSharedSongCopyability(
          sharedRepertoire.songs,
          myRepertoire
        );
        setSongs(resolvedSongs);
        setSelectedSongIds(
          new Set(
            resolvedSongs
              .filter((song) => song.duplicateStatus !== "exact")
              .map((song) => song.id)
          )
        );
      } catch (err) {
        console.error(err);
        setMessage("Could not load songs to copy. Check the link and try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [normalizedCode]);

  const selectedSongs = useMemo(
    () => songs.filter((song) => selectedSongIds.has(song.id)),
    [selectedSongIds, songs]
  );
  const selectedVoicings = useMemo(
    () => Array.from(new Set(selectedSongs.map((song) => song.voicing))).sort(),
    [selectedSongs]
  );
  const eligibleSongs = songs.filter((song) => song.duplicateStatus !== "exact");
  const signInPath = `/login?redirect=${encodeURIComponent(
    `/shared-repertoire/${normalizedCode}`
  )}`;

  function toggleSong(song: CopyableSharedSong) {
    if (song.duplicateStatus === "exact") return;

    setSelectedSongIds((current) => {
      const next = new Set(current);
      if (next.has(song.id)) {
        next.delete(song.id);
      } else {
        next.add(song.id);
      }
      return next;
    });
  }

  function selectAllEligible() {
    setSelectedSongIds(new Set(eligibleSongs.map((song) => song.id)));
  }

  function clearSelection() {
    setSelectedSongIds(new Set());
  }

  function updateVoicingSelection(
    voicing: Voicing,
    patch: Partial<{ part: Part | ""; confidence: Confidence | "" }>
  ) {
    setSelectionsByVoicing((current) => ({
      ...current,
      [voicing]: {
        part: current[voicing]?.part ?? "",
        confidence: current[voicing]?.confidence ?? "",
        ...patch,
      },
    }));
  }

  async function copySelectedSongs() {
    if (!isSignedIn) {
      window.location.href = signInPath;
      return;
    }

    if (selectedSongs.length === 0) {
      setMessage("Select at least one song to copy.");
      return;
    }

    const missingVoicing = selectedVoicings.find((voicing) => {
      const selection = selectionsByVoicing[voicing];
      return !selection?.part || !selection?.confidence;
    });

    if (missingVoicing) {
      setMessage(`Choose a part and confidence for ${missingVoicing}.`);
      return;
    }

    const completeSelections = Object.fromEntries(
      selectedVoicings.map((voicing) => {
        const selection = selectionsByVoicing[voicing];
        return [
          voicing,
          {
            part: selection?.part as Part,
            confidence: selection?.confidence as Confidence,
          },
        ];
      })
    ) as Record<Voicing, { part: Part; confidence: Confidence }>;

    try {
      setCopying(true);
      setMessage("");
      const result = await copySharedSongsToMyRepertoire(
        selectedSongs as SharedRepertoireSong[],
        completeSelections
      );
      setMessage(
        `${result.copiedCount} ${
          result.copiedCount === 1 ? "song" : "songs"
        } copied${
          result.skippedExactCount > 0
            ? `; ${result.skippedExactCount} already in My Songs`
            : ""
        }.`
      );

      const myRepertoire = await getMyRepertoire();
      const refreshedSongs = resolveSharedSongCopyability(
        share?.songs ?? [],
        myRepertoire
      );
      setSongs(refreshedSongs);
      setSelectedSongIds(new Set());
    } catch (err) {
      console.error(err);
      setMessage("Could not copy songs. Check your connection and try again.");
    } finally {
      setCopying(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading songs to copy...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <AppNav />

        {!share ? (
          <section className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-6">
            <h1 className="text-3xl font-bold">Copy link unavailable</h1>
            <p className="mt-3 text-slate-200">
              This copy link may have been revoked, expired, or typed
              incorrectly.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-6">
              <p className="text-sm font-semibold uppercase tracking-normal text-cyan-200">
                Copy songs from another singer
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                {share.ownerDisplayName} shared songs with you
              </h1>
              <p className="mt-3 max-w-3xl text-slate-200">
                {isSignedIn
                  ? "You can copy songs into My Songs. You'll choose your own part and confidence before saving."
                  : "Sign in to copy songs into My Songs."}
              </p>
              {!isSignedIn && (
                <a
                  href={signInPath}
                  className="mt-5 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200"
                >
                  Sign in to copy songs
                </a>
              )}
            </section>

            {isSignedIn && songs.length > 0 && (
              <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-2xl font-semibold">Copy songs</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  For copied songs, choose the part you usually sing and your
                  confidence. You can edit individual songs later.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllEligible}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-white/20"
                  >
                    Select all eligible
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/20"
                  >
                    Clear selection
                  </button>
                </div>

                {selectedVoicings.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {selectedVoicings.map((voicing) => (
                      <div
                        key={voicing}
                        className="rounded-xl border border-white/10 bg-slate-950/60 p-3"
                      >
                        <p className="text-sm font-semibold text-white">
                          {voicing} copied songs
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                              Part
                            </span>
                            <select
                              value={selectionsByVoicing[voicing]?.part ?? ""}
                              onChange={(event) =>
                                updateVoicingSelection(voicing, {
                                  part: event.target.value as Part | "",
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                            >
                              <option value="">Choose part</option>
                              {partsByVoicing[voicing].map((part) => (
                                <option key={part} value={part}>
                                  {partButtonLabel(voicing, part)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                              Confidence
                            </span>
                            <select
                              value={
                                selectionsByVoicing[voicing]?.confidence ?? ""
                              }
                              onChange={(event) =>
                                updateVoicingSelection(voicing, {
                                  confidence: event.target
                                    .value as Confidence | "",
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                            >
                              <option value="">Choose confidence</option>
                              {confidenceLevels.map((confidence) => (
                                <option key={confidence} value={confidence}>
                                  {confidence}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={copySelectedSongs}
                  disabled={copying || selectedSongs.length === 0}
                  className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                >
                  {copying
                    ? "Copying..."
                    : `Copy ${selectedSongs.length} selected ${
                        selectedSongs.length === 1 ? "song" : "songs"
                      }`}
                </button>
              </section>
            )}

            {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}

            <section className="mt-5 rounded-2xl border border-white/10 bg-white/10">
              <div className="border-b border-white/10 p-4">
                <h2 className="text-2xl font-semibold">Shared songs</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {songs.length} {songs.length === 1 ? "song" : "songs"} shared
                </p>
              </div>

              {songs.length === 0 ? (
                <p className="p-4 text-sm text-slate-300">
                  This share link is active, but there are no songs to copy yet.
                </p>
              ) : (
                <div className="divide-y divide-white/10">
                  {songs.map((song) => {
                    const label = duplicateLabel(song.duplicateStatus);
                    const disabled = song.duplicateStatus === "exact";

                    return (
                      <label
                        key={song.id}
                        className={`flex gap-3 p-4 ${
                          disabled ? "opacity-70" : "cursor-pointer"
                        }`}
                      >
                        {isSignedIn && (
                          <input
                            type="checkbox"
                            checked={selectedSongIds.has(song.id)}
                            disabled={disabled}
                            onChange={() => toggleSong(song)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-white">
                            {song.songTitle}
                          </span>
                          <span className="mt-1 block text-sm text-slate-300">
                            {song.voicing} - Arr.{" "}
                            {arrangerDisplayName(song.arrangerName)}
                          </span>
                          {label && (
                            <span className="mt-2 inline-flex rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                              {label}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
