"use client";

import { useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { QuartetActionConfirmation } from "@/components/QuartetActionConfirmation";
import type {
  Confidence,
  Part,
  PartConfidence,
  Voicing,
} from "@/lib/matching";
import { partAbbreviation, partButtonLabel } from "@/lib/partAbbreviations";
import {
  filterAndSortRepertoire,
  hasActiveRepertoireFilters,
  type RepertoireSortOption,
} from "@/lib/repertoireView";
import { trackEvent } from "@/lib/analytics";
import {
  addRepertoireItem,
  deleteRepertoireItem,
  getMyRepertoire,
  updateRepertoireItem,
  type RepertoireRow,
} from "@/lib/repertoireStore";
import {
  getSongSuggestions,
  type SongSuggestion,
} from "@/lib/songSuggestions";
import { getCurrentUser, getMyProfile } from "@/lib/profileStore";
import { refreshActiveQuartetSnapshot } from "@/lib/activeQuartetSnapshot";

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

const emptyPartRow = (): PartConfidenceFormRow => ({
  part: "",
  confidence: "",
});

type RepertoireForm = {
  songTitle: string;
  voicing: Voicing;
  arrangerName: string;
  partRows: PartConfidenceFormRow[];
  notes: string;
};

type PartConfidenceFormRow = {
  part: Part | "";
  confidence: Confidence | "";
};

export default function RepertoireManager() {
  const songTitleInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RepertoireRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] =
    useState<RepertoireSortOption>("title_asc");
  const [voicingFilter, setVoicingFilter] = useState<Voicing | "">("");
  const [partFilter, setPartFilter] = useState<Part | "">("");
  const [neverSungOnly, setNeverSungOnly] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [voicing, setVoicing] = useState<Voicing | "">("");
  const [arrangerName, setArrangerName] = useState("");
  const [notes, setNotes] = useState("");
  const [partRows, setPartRows] = useState<PartConfidenceFormRow[]>([
    { part: "", confidence: "" },
  ]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showArranger, setShowArranger] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RepertoireForm | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RepertoireRow | null>(null);

  function completePartConfidences(
    rows: PartConfidenceFormRow[]
  ): PartConfidence[] {
    return rows
      .filter(
        (row): row is PartConfidence =>
          Boolean(row.part) && Boolean(row.confidence)
      )
      .map((row) => ({
        part: row.part,
        confidence: row.confidence,
      }));
  }

  function hasDuplicateParts(rows: PartConfidenceFormRow[]) {
    const selectedParts = rows
      .map((row) => row.part)
      .filter((part): part is Part => Boolean(part));
    return new Set(selectedParts).size !== selectedParts.length;
  }

  function rowHasMissingPartOrConfidence(rows: PartConfidenceFormRow[]) {
    return rows.some((row) => !row.part || !row.confidence);
  }

  async function loadRepertoire() {
    try {
      setLoadError("");
      const user = await getCurrentUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const data = await getMyRepertoire();
      setItems(data);
      setLoadError("");
    } catch (err) {
      console.error(err);
      setLoadError(
        "Could not load your repertoire. Check your connection and try again."
      );
      throw err;
    }
  }

  async function retryLoadRepertoire() {
    try {
      await loadRepertoire();
    } catch {
      // loadRepertoire already shows the retry message.
    }
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

  useEffect(() => {
    if (!isAddOpen) return;

    const frame = window.requestAnimationFrame(() => {
      songTitleInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isAddOpen]);

  function resetAddForm() {
    setSongTitle("");
    setVoicing("");
    setArrangerName("");
    setNotes("");
    setPartRows([emptyPartRow()]);
    setShowArranger(false);
  }

  function openAddModal() {
    setMessage("");
    setIsAddOpen(true);
  }

  function closeAddModal() {
    resetAddForm();
    setIsAddOpen(false);
    setMessage("");
  }

  function selectSongSuggestion(suggestion: SongSuggestion) {
    setSongTitle(suggestion.songTitle);
    setVoicing(suggestion.voicing);
    setArrangerName(suggestion.arrangerName);
    setShowArranger(Boolean(suggestion.arrangerName));
    setPartRows([emptyPartRow()]);
    setMessage("");
  }

  function startEditing(item: RepertoireRow) {
    setEditingId(item.id);
    setEditForm({
      songTitle: item.song_title,
      voicing: item.voicing,
      arrangerName: item.arranger_name ?? "",
      partRows: item.part_confidences,
      notes: item.notes ?? "",
    });
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  function updateVoicingFilter(nextVoicing: Voicing | "") {
    setVoicingFilter(nextVoicing);
    setPartFilter((currentPart) => {
      if (!nextVoicing || !currentPart) return currentPart;
      return partsByVoicing[nextVoicing].includes(currentPart) ? currentPart : "";
    });
  }

  function clearRepertoireFilters() {
    setSearchQuery("");
    setVoicingFilter("");
    setPartFilter("");
    setNeverSungOnly(false);
  }

  function updateEditForm(patch: Partial<RepertoireForm>) {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  }

  function updatePartRow(
    rowIndex: number,
    patch: Partial<PartConfidenceFormRow>
  ) {
    setPartRows((current) =>
      current.map((row, index) =>
        index === rowIndex ? { ...row, ...patch } : row
      )
    );
  }

  function addPartRow() {
    setPartRows((current) => [...current, emptyPartRow()]);
  }

  function removePartRow(rowIndex: number) {
    setPartRows((current) =>
      current.length <= 1
        ? current
        : current.filter((_, index) => index !== rowIndex)
    );
  }

  function updateEditPartRow(
    rowIndex: number,
    patch: Partial<PartConfidenceFormRow>
  ) {
    setEditForm((current) => {
      if (!current) return current;

      return {
        ...current,
        partRows: current.partRows.map((row, index) =>
          index === rowIndex ? { ...row, ...patch } : row
        ),
      };
    });
  }

  function addEditPartRow() {
    setEditForm((current) =>
      current
        ? { ...current, partRows: [...current.partRows, emptyPartRow()] }
        : current
    );
  }

  function removeEditPartRow(rowIndex: number) {
    setEditForm((current) => {
      if (!current || current.partRows.length <= 1) return current;

      return {
        ...current,
        partRows: current.partRows.filter((_, index) => index !== rowIndex),
      };
    });
  }

  async function addItem() {
    if (isAdding) return;

    if (!songTitle.trim()) {
      setMessage("Add a song title before saving.");
      return;
    }

    if (!voicing) {
      setMessage("Choose a voicing before saving.");
      return;
    }

    if (rowHasMissingPartOrConfidence(partRows)) {
      setMessage("Choose a part and confidence for each row before saving.");
      return;
    }

    if (hasDuplicateParts(partRows)) {
      setMessage("Use each part only once for this song.");
      return;
    }

    try {
      setIsAdding(true);
      const partConfidences = completePartConfidences(partRows);
      await addRepertoireItem({
        songTitle: songTitle.trim(),
        voicing,
        arrangerName: arrangerName.trim() || undefined,
        partConfidences,
        notes: notes.trim() || undefined,
      });

      resetAddForm();
      setIsAddOpen(false);
      setMessage("Song added.");
      trackEvent("repertoire_song_added", {
        song_count: items.length + 1,
        parts_known_count: partConfidences.length,
      });
      trackEvent("repertoire_updated", {
        action: "add",
        song_count: items.length + 1,
        parts_known_count: partConfidences.length,
      });
      let snapshotUpdated = true;
      try {
        await refreshActiveQuartetSnapshot();
      } catch (err) {
        snapshotUpdated = false;
        console.error("Could not update active quartet snapshot", err);
        setMessage("Song added, but quartet matches could not be updated yet.");
      }

      try {
        await loadRepertoire();
      } catch {
        setMessage(
          snapshotUpdated
            ? "Song added. Could not refresh the list yet."
            : "Song added, but quartet matches could not be updated yet."
        );
      }
    } catch (err) {
      console.error(err);
      trackEvent("repertoire_update_failed", {
        action: "add",
      });
      setMessage("Could not add song. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  function requestDeleteItem(item: RepertoireRow) {
    if (deletingId) return;

    setMessage("");
    setItemToDelete(item);
  }

  async function deleteItem(id: string) {
    if (deletingId) return;

    try {
      setDeletingId(id);
      await deleteRepertoireItem(id);
      if (editingId === id) {
        cancelEditing();
      }
      setItemToDelete(null);
      setMessage("Song deleted.");
      trackEvent("repertoire_song_deleted", {
        song_count: Math.max(0, items.length - 1),
      });
      trackEvent("repertoire_updated", {
        action: "delete",
        song_count: Math.max(0, items.length - 1),
      });
      let snapshotUpdated = true;
      try {
        await refreshActiveQuartetSnapshot();
      } catch (err) {
        snapshotUpdated = false;
        console.error("Could not update active quartet snapshot", err);
        setMessage("Song deleted, but quartet matches could not be updated yet.");
      }
      try {
        await loadRepertoire();
      } catch {
        setMessage(
          snapshotUpdated
            ? "Song deleted. Could not refresh the list yet."
            : "Song deleted, but quartet matches could not be updated yet."
        );
      }
    } catch (err) {
      console.error(err);
      trackEvent("repertoire_update_failed", {
        action: "delete",
      });
      setMessage("Could not delete song. Please try again.");
      setItemToDelete(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function confirmDeleteItem() {
    if (!itemToDelete) return;

    await deleteItem(itemToDelete.id);
  }

  async function saveEdit(id: string) {
    if (savingEditId) return;

    if (!editForm) {
      return;
    }

    if (!editForm.songTitle.trim()) {
      setMessage("Add a song title before saving changes.");
      return;
    }

    if (rowHasMissingPartOrConfidence(editForm.partRows)) {
      setMessage(
        "Choose a part and confidence for each row before saving changes."
      );
      return;
    }

    if (hasDuplicateParts(editForm.partRows)) {
      setMessage("Use each part only once for this song.");
      return;
    }

    try {
      setSavingEditId(id);
      const partConfidences = completePartConfidences(editForm.partRows);
      await updateRepertoireItem(id, {
        songTitle: editForm.songTitle.trim(),
        voicing: editForm.voicing,
        arrangerName: editForm.arrangerName.trim() || undefined,
        partConfidences,
        notes: editForm.notes.trim() || undefined,
      });

      cancelEditing();
      setMessage("Song updated.");
      trackEvent("repertoire_song_edited", {
        song_count: items.length,
        parts_known_count: partConfidences.length,
      });
      trackEvent("repertoire_updated", {
        action: "edit",
        song_count: items.length,
        parts_known_count: partConfidences.length,
      });
      let snapshotUpdated = true;
      try {
        await refreshActiveQuartetSnapshot();
      } catch (err) {
        snapshotUpdated = false;
        console.error("Could not update active quartet snapshot", err);
        setMessage("Song saved, but quartet matches could not be updated yet.");
      }
      try {
        await loadRepertoire();
      } catch {
        setMessage(
          snapshotUpdated
            ? "Song updated. Could not refresh the list yet."
            : "Song saved, but quartet matches could not be updated yet."
        );
      }
    } catch (err) {
      console.error(err);
      trackEvent("repertoire_update_failed", {
        action: "edit",
      });
      setMessage("Could not save changes. Please try again.");
    } finally {
      setSavingEditId(null);
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
    !rowHasMissingPartOrConfidence(partRows) &&
    !hasDuplicateParts(partRows);
  const repertoireFilters = {
    searchQuery,
    voicing: voicingFilter,
    part: partFilter,
    neverSungOnly,
    sort: sortOption,
  };
  const visibleItems = filterAndSortRepertoire(items, repertoireFilters);
  const songSuggestions = getSongSuggestions(items, songTitle);
  const hasActiveFilters = hasActiveRepertoireFilters(repertoireFilters);
  const partFilterOptions = voicingFilter
    ? partsByVoicing[voicingFilter]
    : Array.from(new Set(voicings.flatMap((v) => partsByVoicing[v])));
  const filteredEmptyDescription = [
    voicingFilter,
    partFilter
      ? voicingFilter
        ? partButtonLabel(voicingFilter, partFilter)
        : partFilter
      : "",
    neverSungOnly ? "never sung" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <AppNav />
        <QuartetActionConfirmation
          open={Boolean(itemToDelete)}
          busy={Boolean(deletingId)}
          title="Delete song?"
          description={`This will remove "${
            itemToDelete?.song_title ?? "this song"
          }" from your repertoire. This cannot be undone.`}
          confirmLabel="Delete song"
          busyLabel="Deleting..."
          onCancel={() => setItemToDelete(null)}
          onConfirm={confirmDeleteItem}
        />

        <h1 className="mt-4 text-4xl font-bold tracking-tight">My Repertoire</h1>
        <p className="mt-2 text-slate-300">
          Add songs you know, the parts you can sing, and how confident you are.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          See what data is stored and why on the{" "}
          <a
            href="/privacy"
            className="font-semibold text-cyan-300 hover:text-cyan-200"
          >
            privacy page
          </a>
          .
        </p>

        {loadError && (
          <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={retryLoadRepertoire}
              className="mt-3 rounded-xl bg-rose-100 px-4 py-2 font-semibold text-slate-950 hover:bg-white"
            >
              Try again
            </button>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}

        <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Add a song</h2>
            <p className="mt-1 text-sm text-slate-400">
              Save a song, voicing, confidence, and the parts you know.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Add song
          </button>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Songs I know</h2>
              <p className="mt-1 text-sm text-slate-400">
                {visibleItems.length === items.length
                  ? `${items.length} ${items.length === 1 ? "song" : "songs"} saved`
                  : `${visibleItems.length} of ${items.length} songs shown`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,18rem)_11rem_11rem_11rem]">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Search by title
                </span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Sort
                </span>
                <select
                  value={sortOption}
                  onChange={(e) =>
                    setSortOption(e.target.value as RepertoireSortOption)
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                >
                  <option value="title_asc">Title A-Z</option>
                  <option value="created_desc">Added newest</option>
                  <option value="created_asc">Added oldest</option>
                  <option value="last_sung_desc">Sung recently</option>
                  <option value="last_sung_asc">Least recently sung</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Voicing
                </span>
                <select
                  value={voicingFilter}
                  onChange={(e) =>
                    updateVoicingFilter(e.target.value as Voicing | "")
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                >
                  <option value="">All voicings</option>
                  {voicings.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Part
                </span>
                <select
                  value={partFilter}
                  onChange={(e) => setPartFilter(e.target.value as Part | "")}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                >
                  <option value="">All parts</option>
                  {partFilterOptions.map((part) => (
                    <option key={part} value={part}>
                      {voicingFilter ? partButtonLabel(voicingFilter, part) : part}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={neverSungOnly}
                onChange={(e) => setNeverSungOnly(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300"
              />
              Never sung
            </label>

            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                {searchQuery.trim() && (
                  <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    Title: {searchQuery.trim()}
                  </span>
                )}
                {voicingFilter && (
                  <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    {voicingFilter}
                  </span>
                )}
                {partFilter && (
                  <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    {voicingFilter
                      ? partButtonLabel(voicingFilter, partFilter)
                      : partFilter}
                  </span>
                )}
                {neverSungOnly && (
                  <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    Never sung
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearRepertoireFilters}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No filters active</p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {items.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                <p className="font-semibold text-white">No songs yet.</p>
                <p className="mt-1">
                  Add a song with the part or parts you know. Your
                  repertoire is what powers quartet matches.
                </p>
              </div>
            )}

            {items.length > 0 && visibleItems.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                {filteredEmptyDescription
                  ? `No ${filteredEmptyDescription} songs match these filters.`
                  : "No songs match these filters."}
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
                              partRows: [emptyPartRow()],
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        >
                          {voicings.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-slate-300">
                          Notes (optional)
                        </span>
                        <textarea
                          value={editForm.notes}
                          onChange={(e) =>
                            updateEditForm({ notes: e.target.value })
                          }
                          rows={3}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                        />
                      </label>
                    </div>

                    <div className="mt-5">
                      <p className="text-sm font-medium text-slate-300">
                        Parts and confidence
                      </p>
                      <div className="mt-2 space-y-3">
                        {editForm.partRows.map((row, rowIndex) => (
                          <div
                            key={rowIndex}
                            className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:grid-cols-[1fr_1fr_auto]"
                          >
                            <label className="block">
                              <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                                Part
                              </span>
                              <select
                                value={row.part}
                                onChange={(e) =>
                                  updateEditPartRow(rowIndex, {
                                    part: e.target.value as Part | "",
                                  })
                                }
                                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                              >
                                <option value="">Choose part</option>
                                {partsByVoicing[editForm.voicing].map((part) => (
                                  <option
                                    key={part}
                                    value={part}
                                    disabled={editForm.partRows.some(
                                      (candidate, candidateIndex) =>
                                        candidateIndex !== rowIndex &&
                                        candidate.part === part
                                    )}
                                  >
                                    {partButtonLabel(editForm.voicing, part)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                                Confidence
                              </span>
                              <select
                                value={row.confidence}
                                onChange={(e) =>
                                  updateEditPartRow(rowIndex, {
                                    confidence: e.target.value as Confidence | "",
                                  })
                                }
                                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                              >
                                <option value="">Choose confidence</option>
                                {confidenceLevels.map((level) => (
                                  <option key={level} value={level}>
                                    {level}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              onClick={() => removeEditPartRow(rowIndex)}
                              disabled={editForm.partRows.length <= 1}
                              className="min-h-12 rounded-xl bg-slate-800 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40 sm:self-end"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addEditPartRow}
                        disabled={
                          editForm.partRows.length >=
                          partsByVoicing[editForm.voicing].length
                        }
                        className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-white/20 disabled:opacity-40"
                      >
                        Add another part
                      </button>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => saveEdit(item.id)}
                        disabled={savingEditId === item.id || deletingId === item.id}
                        className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                      >
                        {savingEditId === item.id ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={savingEditId === item.id || deletingId === item.id}
                        className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => requestDeleteItem(item)}
                        disabled={savingEditId === item.id || deletingId === item.id}
                        className="rounded-xl bg-rose-400/10 px-5 py-3 font-semibold text-rose-200 hover:bg-rose-400/20 disabled:opacity-40"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
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
                        {item.part_confidences.map(({ part, confidence }) => (
                          <span
                            key={part}
                            className="rounded-full bg-cyan-300/10 px-2 py-0.5 font-semibold text-cyan-100 ring-1 ring-cyan-300/20"
                          >
                            {partAbbreviation(item.voicing, part)} · {confidence}
                          </span>
                        ))}
                        {item.arranger_name && (
                          <span className="truncate text-slate-400">
                            Arr. {item.arranger_name}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          Notes: {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startEditing(item)}
                        disabled={Boolean(deletingId)}
                        className="rounded-lg bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => requestDeleteItem(item)}
                        disabled={deletingId === item.id}
                        className="rounded-lg bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/20 disabled:opacity-40"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {isAddOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-song-title"
            className="fixed inset-0 z-50 flex items-end bg-slate-950/80 px-0 sm:items-center sm:px-6"
          >
            <button
              type="button"
              aria-label="Close add song form"
              onClick={closeAddModal}
              className="absolute inset-0 cursor-default"
            />
            <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="add-song-title" className="text-2xl font-semibold">
                    Add a song
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Save the parts you know for this arrangement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>

              {message && (
                <p className="mt-4 text-sm text-slate-300">{message}</p>
              )}

              <div className="mt-5 space-y-5">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Song title
                  </span>
                  <input
                    ref={songTitleInputRef}
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                  />
                  {songSuggestions.length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-900">
                      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-normal text-slate-400">
                        Existing songs
                      </p>
                      <div className="divide-y divide-white/10">
                        {songSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.songTitle}:${suggestion.voicing}:${suggestion.arrangerName}`}
                            type="button"
                            onClick={() => selectSongSuggestion(suggestion)}
                            className="w-full px-3 py-3 text-left hover:bg-cyan-300/10 focus:bg-cyan-300/10 focus:outline-none"
                          >
                            <span className="block font-semibold text-white">
                              {suggestion.songTitle}
                            </span>
                            <span className="mt-1 block text-xs text-slate-300">
                              {suggestion.voicing}
                              {suggestion.arrangerName
                                ? ` · ${suggestion.arrangerName}`
                                : " · Arranger unknown"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </label>

                <div>
                  <p className="text-sm font-medium text-slate-300">Voicing</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {voicings.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setVoicing(v);
                          setPartRows([emptyPartRow()]);
                        }}
                        className={`min-h-12 rounded-xl px-3 py-3 text-sm font-semibold ring-1 ${
                          voicing === v
                            ? "bg-cyan-300 text-slate-950 ring-cyan-200"
                            : "bg-slate-800 text-slate-200 ring-white/10 hover:bg-slate-700"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Parts and confidence
                  </p>
                  <div className="mt-2 space-y-3">
                    {voicing ? (
                      partRows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:grid-cols-[1fr_1fr_auto]"
                        >
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                              Part
                            </span>
                            <select
                              value={row.part}
                              onChange={(e) =>
                                updatePartRow(rowIndex, {
                                  part: e.target.value as Part | "",
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                            >
                              <option value="">Choose part</option>
                              {partsByVoicing[voicing].map((part) => (
                                <option
                                  key={part}
                                  value={part}
                                  disabled={partRows.some(
                                    (candidate, candidateIndex) =>
                                      candidateIndex !== rowIndex &&
                                      candidate.part === part
                                  )}
                                >
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
                              value={row.confidence}
                              onChange={(e) =>
                                updatePartRow(rowIndex, {
                                  confidence: e.target.value as Confidence | "",
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                            >
                              <option value="">Choose confidence</option>
                              {confidenceLevels.map((level) => (
                                <option key={level} value={level}>
                                  {level}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => removePartRow(rowIndex)}
                            disabled={partRows.length <= 1}
                            className="min-h-12 rounded-xl bg-slate-800 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40 sm:self-end"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        Choose a voicing first.
                      </p>
                    )}
                  </div>
                  {voicing && (
                    <button
                      type="button"
                      onClick={addPartRow}
                      disabled={partRows.length >= partsByVoicing[voicing].length}
                      className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-white/20 disabled:opacity-40"
                    >
                      Add another part
                    </button>
                  )}
                </div>

                <div>
                  {showArranger ? (
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
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowArranger(true)}
                      className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-white/20"
                    >
                      Add arranger (optional)
                    </button>
                  )}
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Notes (optional)
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Key, first words, or tricky spots"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!canAddSong || isAdding}
                  className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                >
                  {isAdding ? "Adding..." : "Add to repertoire"}
                </button>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
