"use client";

import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import type { Confidence, Part, Voicing } from "@/lib/matching";
import { arrangerDisplayName } from "@/lib/arrangerDisplay";
import {
  partButtonLabel,
  printedNotationSummary,
  voicingDisplayLabel,
} from "@/lib/partAbbreviations";
import { getCurrentUser } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import { serviceErrorMessage } from "@/lib/runtimeErrors";
import {
  copySharedSongsToMyRepertoire,
  getSharedRepertoire,
  resolveSharedSongCopyability,
  type CopyableSharedSong,
  type SharedRepertoire,
  type SharedRepertoireSong,
  type SharedSongCopySelection,
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

type SongCopySelections = Record<
  string,
  { part: Part | ""; confidence: Confidence | "" }
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
  const [songCopySelections, setSongCopySelections] =
    useState<SongCopySelections>({});
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
          setSongCopySelections({});
          return;
        }

        if (!user) {
          const anonymousSongs = resolveSharedSongCopyability(
            sharedRepertoire.songs,
            []
          );
          setSongs(anonymousSongs);
          setSelectedSongIds(new Set());
          setSongCopySelections({});
          return;
        }

        const myRepertoire = await getMyRepertoire();
        const resolvedSongs = resolveSharedSongCopyability(
          sharedRepertoire.songs,
          myRepertoire
        );
        setSongs(resolvedSongs);
        setSelectedSongIds(new Set());
        setSongCopySelections({});
    } catch (err) {
      console.error(err);
      setMessage(serviceErrorMessage(err, "database_read"));
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
  const eligibleSongs = songs.filter((song) => song.duplicateStatus !== "exact");
  const incompleteSelectedSongs = selectedSongs.filter((song) => {
    const selection = songCopySelections[song.id];
    return !selection?.part || !selection?.confidence;
  });
  const canCopySelectedSongs =
    selectedSongs.length > 0 && incompleteSelectedSongs.length === 0;
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

  function updateSongSelection(
    songId: string,
    patch: Partial<{ part: Part | ""; confidence: Confidence | "" }>
  ) {
    setSongCopySelections((current) => ({
      ...current,
      [songId]: {
        part: current[songId]?.part ?? "",
        confidence: current[songId]?.confidence ?? "",
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

    if (incompleteSelectedSongs.length > 0) {
      setMessage(
        "Choose a part and confidence for each selected song before copying."
      );
      return;
    }

    const completeSelections: SharedSongCopySelection[] = selectedSongs.map(
      (song) => {
        const selection = songCopySelections[song.id];
        return {
          songId: song.id,
          part: selection?.part as Part,
          confidence: selection?.confidence as Confidence,
        };
      }
    );

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
      setSongCopySelections({});
    } catch (err) {
      console.error(err);
      setMessage(serviceErrorMessage(err, "database_write"));
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
              <a
                href="/songs"
                className="inline-flex text-sm font-semibold text-cyan-100 hover:text-white"
              >
                &larr; Back to My Songs
              </a>
              <p className="mt-4 text-sm font-semibold uppercase tracking-normal text-cyan-200">
                Copy songs from another singer
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                {share.ownerDisplayName} shared {songs.length}{" "}
                {songs.length === 1 ? "song" : "songs"} with you
              </h1>
              <p className="mt-3 max-w-3xl text-slate-200">
                {isSignedIn
                  ? "Choose the songs you want to copy into My Songs. For each selected song, choose the part you usually sing and your confidence. Songs already in My Songs are shown but can't be copied again."
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
                  Review the shared songs below. Selected songs show their own
                  part and confidence controls.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllEligible}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-white/20"
                  >
                    Select songs I don&apos;t already have
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/20"
                  >
                    Clear selection
                  </button>
                </div>

                <button
                  type="button"
                  onClick={copySelectedSongs}
                  disabled={copying || !canCopySelectedSongs}
                  className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                >
                  {copying
                    ? "Copying..."
                    : `Copy ${selectedSongs.length} selected ${
                        selectedSongs.length === 1 ? "song" : "songs"
                      }`}
                </button>
                {selectedSongs.length > 0 &&
                  incompleteSelectedSongs.length > 0 && (
                    <p className="mt-2 text-sm text-slate-300">
                      Choose a part and confidence for each selected song before
                      copying.
                    </p>
                  )}
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
                      <div
                        key={song.id}
                        className={`flex gap-3 p-4 ${
                          disabled ? "bg-slate-950/30 opacity-70" : ""
                        }`}
                      >
                        {isSignedIn && (
                          <input
                            type="checkbox"
                            checked={selectedSongIds.has(song.id)}
                            disabled={disabled}
                            onChange={() => toggleSong(song)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300"
                            aria-label={`Select ${song.songTitle}`}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block font-semibold text-white">
                            {song.songTitle}
                          </span>
                          <span className="mt-1 block text-sm text-slate-300">
                            {voicingDisplayLabel(song.voicing)} - Arr.{" "}
                            {arrangerDisplayName(song.arrangerName)}
                          </span>
                          {label && (
                            <span className="mt-2 inline-flex rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                              {label}
                            </span>
                          )}
                          {song.duplicateStatus ===
                            "possible_arrangement" && (
                            <span className="mt-2 block text-xs text-slate-400">
                              Check the arranger before copying.
                            </span>
                          )}
                          {isSignedIn && selectedSongIds.has(song.id) && (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                                  Part
                                </span>
                                <select
                                  value={songCopySelections[song.id]?.part ?? ""}
                                  onChange={(event) =>
                                    updateSongSelection(song.id, {
                                      part: event.target.value as Part | "",
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                                >
                                  <option value="">Choose part</option>
                                  {partsByVoicing[song.voicing].map((part) => (
                                    <option key={part} value={part}>
                                      {partButtonLabel(song.voicing, part)}
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
                                    songCopySelections[song.id]?.confidence ?? ""
                                  }
                                  onChange={(event) =>
                                    updateSongSelection(song.id, {
                                      confidence: event.target
                                        .value as Confidence | "",
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                                >
                                  <option value="">Choose confidence</option>
                                  {confidenceLevels.map((confidence) => (
                                    <option
                                      key={confidence}
                                      value={confidence}
                                    >
                                      {confidence}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <span className="text-xs text-slate-400 sm:col-span-2">
                                {printedNotationSummary(song.voicing)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
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
