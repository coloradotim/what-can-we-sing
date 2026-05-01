"use client";

import QRCode from "qrcode";
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
  searchRepertoireSongSuggestions,
  updateRepertoireItem,
  type RepertoireRow,
} from "@/lib/repertoireStore";
import {
  createRepertoireShare,
  getMyActiveRepertoireShare,
  repertoireCopyRequestMessage,
  revokeRepertoireShare,
  sharedRepertoirePathFromInput,
  type RepertoireShare,
} from "@/lib/repertoireSharing";
import {
  songSuggestionSubtitle,
  type SongSuggestion,
} from "@/lib/songSuggestions";
import {
  dismissQuartetNudge,
  getCurrentUser,
  getMyProfile,
} from "@/lib/profileStore";
import { refreshActiveQuartetSnapshot } from "@/lib/activeQuartetSnapshot";
import { arrangerDisplayName } from "@/lib/arrangerDisplay";
import { hasQuartetWorkflowHistory } from "@/lib/activeQuartet";
import {
  hasDuplicateParts,
  isRepertoireSongFormValid,
  rowHasMissingPartOrConfidence,
  type PartConfidenceFormRow,
} from "@/lib/repertoireForm";

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

const requiredFieldClass =
  "mt-1 w-full rounded-xl border px-4 py-3 text-white outline-none focus:ring-2";
const requiredCompactFieldClass =
  "mt-1 w-full rounded-xl border px-3 py-3 text-white outline-none focus:ring-2";

function requiredFieldStateClass(isIncomplete: boolean) {
  return isIncomplete
    ? "border-rose-300/70 bg-rose-950/30 ring-rose-300"
    : "border-white/10 bg-slate-900 ring-cyan-300";
}

type RepertoireForm = {
  songTitle: string;
  voicing: Voicing;
  arrangerName: string;
  partRows: PartConfidenceFormRow[];
  notes: string;
};

type AddSongSource = "suggestion" | "own-title" | null;

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
  const [songSuggestions, setSongSuggestions] = useState<SongSuggestion[]>([]);
  const [songSuggestionsOpen, setSongSuggestionsOpen] = useState(false);
  const [songSuggestionsLoading, setSongSuggestionsLoading] = useState(false);
  const [suggestedVoicings, setSuggestedVoicings] = useState<Voicing[] | null>(
    null
  );
  const [addSongSource, setAddSongSource] = useState<AddSongSource>(null);
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
  const [hasUsedQuartetWorkflow, setHasUsedQuartetWorkflow] = useState(false);
  const [hasDismissedQuartetNudge, setHasDismissedQuartetNudge] =
    useState(false);
  const [repertoireShare, setRepertoireShare] =
    useState<RepertoireShare | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isRevokingShare, setIsRevokingShare] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareQrUrl, setShareQrUrl] = useState("");
  const [copySourceInput, setCopySourceInput] = useState("");
  const [copySourceMessage, setCopySourceMessage] = useState("");

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
        setHasDismissedQuartetNudge(
          Boolean(profile.has_dismissed_quartet_nudge)
        );

        const data = await getMyRepertoire();
        setItems(data);
        setRepertoireShare(await getMyActiveRepertoireShare());
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

  useEffect(() => {
    setHasUsedQuartetWorkflow(hasQuartetWorkflowHistory());
  }, []);

  useEffect(() => {
    if (!repertoireShare || typeof window === "undefined") {
      setShareQrUrl("");
      return;
    }

    const shareUrl = `${window.location.origin}/shared-repertoire/${repertoireShare.code}`;
    let cancelled = false;

    QRCode.toDataURL(shareUrl)
      .then((qr) => {
        if (!cancelled) setShareQrUrl(qr);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setShareQrUrl("");
          setShareMessage("QR code unavailable. Use the code or link instead.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repertoireShare]);

  useEffect(() => {
    if (addSongSource || !songSuggestionsOpen || songTitle.trim().length < 2) {
      setSongSuggestions([]);
      setSongSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setSongSuggestionsLoading(true);
        const suggestions = await searchRepertoireSongSuggestions(songTitle);
        if (!cancelled) {
          setSongSuggestions(suggestions);
        }
      } catch (err) {
        console.error("Could not load song suggestions", err);
        if (!cancelled) {
          setSongSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSongSuggestionsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [addSongSource, songSuggestionsOpen, songTitle]);

  function resetAddForm() {
    setSongTitle("");
    setSongSuggestions([]);
    setSongSuggestionsLoading(false);
    setSongSuggestionsOpen(false);
    setSuggestedVoicings(null);
    setAddSongSource(null);
    setVoicing("");
    setArrangerName("");
    setNotes("");
    setPartRows([emptyPartRow()]);
    setShowArranger(false);
  }

  function openBlankAddModal() {
    resetAddForm();
    setMessage("");
    setIsAddOpen(true);
  }

  function openAddModalWithCurrentTitle() {
    if (!songTitle.trim()) {
      openBlankAddModal();
      return;
    }

    setSongTitle(songTitle.trim());
    setSongSuggestionsOpen(false);
    setAddSongSource("own-title");
    setSuggestedVoicings(null);
    setMessage("");
    setIsAddOpen(true);
  }

  function closeAddModal() {
    resetAddForm();
    setIsAddOpen(false);
    setMessage("");
  }

  function updateSongTitle(value: string) {
    setSongTitle(value);
    setSuggestedVoicings(null);
    setAddSongSource(null);
    setSongSuggestionsOpen(true);
  }

  function openSongSuggestionsForFocus() {
    if (addSongSource) return;
    setSongSuggestionsOpen(true);
  }

  function selectSongSuggestion(suggestion: SongSuggestion) {
    setSongTitle(suggestion.songTitle);
    setSongSuggestionsOpen(false);
    setSuggestedVoicings(
      suggestion.voicings.length > 1 ? suggestion.voicings : null
    );
    setVoicing(
      suggestion.voicings.length === 1 ? (suggestion.voicings[0] ?? "") : ""
    );
    setArrangerName(suggestion.arrangerName);
    setShowArranger(Boolean(suggestion.arrangerName));
    setPartRows([emptyPartRow()]);
    setAddSongSource("suggestion");
    setMessage("");
  }

  function selectSongSuggestionAndOpen(suggestion: SongSuggestion) {
    selectSongSuggestion(suggestion);
    setIsAddOpen(true);
  }

  async function dismissQuartetTeachingCard() {
    setHasDismissedQuartetNudge(true);

    try {
      await dismissQuartetNudge();
    } catch (err) {
      console.error("Could not save quartet nudge dismissal", err);
    }
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
      const nextSongCount = items.length + 1;
      setMessage(
        !hasUsedQuartetWorkflow && nextSongCount <= 3
          ? "Song added. Add a few more songs for better matches, or start/join a quartet when you're ready."
          : "Song added."
      );
      trackEvent("repertoire_song_added", {
        song_count: nextSongCount,
        parts_known_count: partConfidences.length,
      });
      trackEvent("repertoire_updated", {
        action: "add",
        song_count: nextSongCount,
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

  async function createShareLink() {
    if (isCreatingShare) return;

    try {
      setIsCreatingShare(true);
      setShareMessage("");
      const share = await createRepertoireShare();
      setRepertoireShare(share);
      setShareMessage("Copy link/code created.");
    } catch (err) {
      console.error(err);
      setShareMessage("Could not create copy link/code. Please try again.");
    } finally {
      setIsCreatingShare(false);
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareMessage("Copy link copied.");
    } catch (err) {
      console.error(err);
      setShareMessage("Could not copy automatically. Select and copy the link.");
    }
  }

  async function copyShareCode() {
    if (!repertoireShare) return;

    try {
      await navigator.clipboard.writeText(repertoireShare.code);
      setShareMessage("Copy code copied.");
    } catch (err) {
      console.error(err);
      setShareMessage("Could not copy automatically. Select and copy the code.");
    }
  }

  function openSharedRepertoire() {
    const path = sharedRepertoirePathFromInput(copySourceInput);
    if (!path) {
      setCopySourceMessage(
        "Paste a six-character code or a shared repertoire link."
      );
      return;
    }

    window.location.href = path;
  }

  async function copyRemoteRequestMessage() {
    try {
      await navigator.clipboard.writeText(repertoireCopyRequestMessage);
      setCopySourceMessage("Request message copied.");
    } catch (err) {
      console.error(err);
      setCopySourceMessage(
        "Could not copy automatically. Select and copy the message."
      );
    }
  }

  async function revokeShareLink() {
    if (!repertoireShare || isRevokingShare) return;

    try {
      setIsRevokingShare(true);
      setShareMessage("");
      await revokeRepertoireShare(repertoireShare.id);
      setRepertoireShare(null);
      setShareMessage("Copy link/code revoked.");
    } catch (err) {
      console.error(err);
      setShareMessage("Could not revoke copy link/code. Please try again.");
    } finally {
      setIsRevokingShare(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading repertoire...
      </main>
    );
  }

  const canAddSong = isRepertoireSongFormValid(songTitle, voicing, partRows);
  const canSaveEdit = editForm
    ? isRepertoireSongFormValid(
        editForm.songTitle,
        editForm.voicing,
        editForm.partRows
      )
    : false;
  const repertoireFilters = {
    searchQuery,
    voicing: voicingFilter,
    part: partFilter,
    neverSungOnly,
    sort: sortOption,
  };
  const visibleItems = filterAndSortRepertoire(items, repertoireFilters);
  const hasActiveFilters = hasActiveRepertoireFilters(repertoireFilters);
  const partFilterOptions = voicingFilter
    ? partsByVoicing[voicingFilter]
    : Array.from(new Set(voicings.flatMap((v) => partsByVoicing[v])));
  const hasSavedSongs = items.length > 0;
  const voicingOptions = suggestedVoicings ?? voicings;
  const isActivelySearchingSuggestions = !addSongSource && songSuggestionsOpen;
  const selectedSongSummaryOpen =
    isAddOpen &&
    Boolean(songTitle.trim()) &&
    Boolean(addSongSource) &&
    !isActivelySearchingSuggestions;
  const hasSmallRepertoire = items.length > 0 && items.length <= 3;
  const addSectionTitle =
    items.length === 0
      ? "Add your first song"
      : hasSmallRepertoire
        ? "Keep building your repertoire"
        : "Add a song";
  const addSectionDescription =
    items.length === 0
      ? "Start typing a song title. Choose a suggestion if it matches your arrangement, or add your own title."
      : hasSmallRepertoire
        ? "Add a few songs you are likely to sing. Search and filters become useful once you have more songs saved."
        : "Start typing a song title. Choose a suggestion if it matches your arrangement, or add your own title.";
  const showQuartetTeachingCard =
    !hasDismissedQuartetNudge && !hasUsedQuartetWorkflow && items.length > 0;
  const shareLink =
    repertoireShare && typeof window !== "undefined"
      ? `${window.location.origin}/shared-repertoire/${repertoireShare.code}`
      : "";
  const quartetTeachingTitle =
    items.length <= 2
      ? "Good start - keep building or try a quartet"
      : "Ready to try it with a quartet?";
  const quartetTeachingDescription =
    items.length <= 2
      ? "The more songs you add, the better your match list will be. But you can start or join a quartet now if you just want to try it."
      : "You have a few songs saved. Start a quartet and invite other singers, or join a quartet someone else already started. You can always come back and add more songs later.";
  const quartetTeachingActions =
    items.length <= 2
      ? ([
          { label: "Start a quartet", href: "/session" },
          { label: "Join a quartet", href: "/join" },
        ] as const)
      : ([
          { label: "Start a quartet", href: "/session" },
          { label: "Join a quartet", href: "/join" },
        ] as const);
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

        <section
          className={`mt-8 rounded-2xl border p-5 shadow-2xl shadow-cyan-950/20 sm:p-6 ${
            hasSavedSongs
              ? "border-white/10 bg-white/5"
              : "border-cyan-300/30 bg-cyan-300/10"
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-cyan-200">
                Add songs here
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                {addSectionTitle}
              </h2>
              <p className="mt-2 text-base leading-7 text-slate-200">
                {addSectionDescription}
              </p>
            </div>
          </div>

          <div className="relative mt-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-200">
                Add a song to your repertoire
              </span>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <input
                  value={songTitle}
                  onChange={(e) => updateSongTitle(e.target.value)}
                  onFocus={openSongSuggestionsForFocus}
                  placeholder="Start typing a song title..."
                  autoComplete="off"
                  className="min-h-12 w-full rounded-xl border border-cyan-300/30 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={openAddModalWithCurrentTitle}
                  disabled={!songTitle.trim()}
                  className="min-h-12 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-40 sm:w-40"
                >
                  Add song
                </button>
              </div>
            </label>

            {isActivelySearchingSuggestions && !isAddOpen && songTitle.trim().length >= 2 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-900 shadow-xl">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-normal text-slate-400">
                  Song suggestions are optional
                </p>
                <div className="max-h-80 overflow-y-auto sm:max-h-96">
                  {songSuggestionsLoading ? (
                    <p className="px-3 py-3 text-sm text-slate-300">
                      Searching suggestions...
                    </p>
                  ) : songSuggestions.length > 0 ? (
                    <div className="divide-y divide-white/10">
                      {songSuggestions.map((suggestion) => (
                        <button
                          key={`page:${suggestion.songTitle}:${suggestion.voicings.join(":")}:${suggestion.arrangerName}`}
                          type="button"
                          onClick={() => selectSongSuggestionAndOpen(suggestion)}
                          className="w-full px-3 py-3 text-left hover:bg-cyan-300/10 focus:bg-cyan-300/10 focus:outline-none"
                        >
                          <span className="block font-semibold text-white">
                            {suggestion.songTitle}
                          </span>
                          <span className="mt-1 block text-xs text-slate-300">
                            {songSuggestionSubtitle(suggestion)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3">
                      <p className="text-sm text-slate-300">
                        No suggestion found.
                      </p>
                    </div>
                  )}
                </div>
                <div className="border-t border-cyan-300/20 bg-cyan-300/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-normal text-cyan-200">
                    Don&apos;t see your version?
                  </p>
                  <button
                    type="button"
                    onClick={openAddModalWithCurrentTitle}
                    className="mt-2 w-full rounded-lg bg-cyan-300 px-3 py-2 text-left text-sm font-bold text-slate-950 hover:bg-cyan-200"
                  >
                    Add &quot;{songTitle.trim()}&quot; manually
                  </button>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Choose the voicing, arranger, part, and confidence
                    yourself.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {hasSavedSongs && (
          <section className="mt-5 rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-5 shadow-lg sm:p-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-cyan-200">
                More ways to build your repertoire
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Copy songs with another singer
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Use a private link or code when one singer already has songs
                entered and another singer wants to copy a few of them.
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <h3 className="text-xl font-bold text-white">
                  Copy songs from another singer
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Paste a shared repertoire link or six-character code, then
                  choose which songs to copy into your repertoire.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <label className="sr-only" htmlFor="shared-repertoire-code">
                    Shared repertoire link or code
                  </label>
                  <input
                    id="shared-repertoire-code"
                    value={copySourceInput}
                    onChange={(event) => {
                      setCopySourceInput(event.target.value);
                      setCopySourceMessage("");
                    }}
                    placeholder="Paste link or code"
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={openSharedRepertoire}
                    className="min-h-12 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200"
                  >
                    Open shared repertoire
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <p>
                    Standing together? Ask the other singer to open Repertoire,
                    choose &quot;Let another singer copy songs from my
                    repertoire,&quot; and show you the code or QR code.
                  </p>
                  <p>
                    Not together? Copy this request and send it by text or
                    email.
                  </p>
                </div>
                <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3">
                  <p className="text-sm leading-6 text-slate-100">
                    {repertoireCopyRequestMessage}
                  </p>
                  <button
                    type="button"
                    onClick={copyRemoteRequestMessage}
                    className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-white/20"
                  >
                    Copy request message
                  </button>
                </div>
                {copySourceMessage && (
                  <p className="mt-3 text-sm text-slate-300">
                    {copySourceMessage}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <h3 className="text-xl font-bold text-white">
                  Let another singer copy songs from my repertoire
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Create a private link and code another singer can use to copy
                  selected song titles, voicings, and arrangers from your
                  repertoire.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  They cannot see your notes, confidence, last-sung history, or
                  email address. They will choose their own part and confidence
                  before saving anything.
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  {repertoireShare ? (
                    <>
                      <p className="text-sm font-semibold text-cyan-100">
                        Your repertoire copy link is ready
                      </p>
                      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-normal text-cyan-200">
                          Copy code
                        </p>
                        <p className="mt-1 text-3xl font-black tracking-[0.2em] text-white">
                          {repertoireShare.code}
                        </p>
                        {shareQrUrl && (
                          <img
                            src={shareQrUrl}
                            alt="QR code for repertoire copy link"
                            className="mx-auto mt-3 h-36 w-36 rounded-xl bg-white p-2"
                          />
                        )}
                      </div>
                      <p className="text-xs leading-5 text-slate-400">
                        If you are standing together, show the QR code or code.
                        If not, send the link or code by text or email. Revoke
                        the link whenever you are done.
                      </p>
                      <input
                        value={shareLink}
                        readOnly
                        className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                        aria-label="Repertoire copy link"
                      />
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        <button
                          type="button"
                          onClick={copyShareLink}
                          className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200"
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          onClick={copyShareCode}
                          className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-white/20"
                        >
                          Copy code
                        </button>
                        <button
                          type="button"
                          onClick={revokeShareLink}
                          disabled={isRevokingShare}
                          className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/20 disabled:opacity-40"
                        >
                          {isRevokingShare ? "Revoking..." : "Revoke link"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm leading-6 text-slate-300">
                        Standing together? Create the link/code and show the QR
                        code. Remote? Create it and send the link or code.
                      </p>
                      <button
                        type="button"
                        onClick={createShareLink}
                        disabled={isCreatingShare}
                        className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                      >
                        {isCreatingShare ? "Creating..." : "Create link/code"}
                      </button>
                    </>
                  )}
                  {shareMessage && (
                    <p className="text-sm text-slate-300">{shareMessage}</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {showQuartetTeachingCard && (
          <section className="mt-5 rounded-2xl border border-cyan-300/20 bg-slate-900/80 p-5 shadow-lg sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {quartetTeachingTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {quartetTeachingDescription}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                {quartetTeachingActions.map((action, index) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className={`rounded-xl px-4 py-3 text-center text-sm font-bold ${
                      index === 0
                        ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                        : "bg-white/10 text-cyan-100 hover:bg-white/20"
                    }`}
                  >
                    {action.label}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={dismissQuartetTeachingCard}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/20"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        )}

        {hasSavedSongs && (
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

              <div
                className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,18rem)_11rem_11rem_11rem] ${
                  hasSmallRepertoire ? "opacity-75" : ""
                }`}
              >
                <p className="text-sm font-semibold text-slate-300 sm:col-span-2 lg:col-span-4">
                  Filter saved songs
                </p>
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Search my repertoire
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter songs you've already added"
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
                        {voicingFilter
                          ? partButtonLabel(voicingFilter, part)
                          : part}
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
              {visibleItems.length === 0 && (
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
                          aria-invalid={!editForm.songTitle.trim()}
                          className={`${requiredFieldClass} ${requiredFieldStateClass(
                            !editForm.songTitle.trim()
                          )}`}
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
                                aria-invalid={!row.part}
                                className={`${requiredCompactFieldClass} ${requiredFieldStateClass(
                                  !row.part
                                )}`}
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
                                aria-invalid={!row.confidence}
                                className={`${requiredCompactFieldClass} ${requiredFieldStateClass(
                                  !row.confidence
                                )}`}
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
                        disabled={
                          !canSaveEdit ||
                          savingEditId === item.id ||
                          deletingId === item.id
                        }
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
                        <span className="truncate text-slate-400">
                          Arr. {arrangerDisplayName(item.arranger_name)}
                        </span>
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
        )}

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
                    onChange={(e) => updateSongTitle(e.target.value)}
                    onFocus={openSongSuggestionsForFocus}
                    autoComplete="off"
                    aria-invalid={!songTitle.trim()}
                    className={`${requiredFieldClass} ${requiredFieldStateClass(
                      !songTitle.trim()
                    )}`}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Start typing to see suggestions, or enter your own song
                    title.
                  </p>
                  {isActivelySearchingSuggestions && songTitle.trim().length >= 2 && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-900">
                      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-normal text-slate-400">
                        Song suggestions are optional
                      </p>
                      <div className="max-h-80 overflow-y-auto sm:max-h-96">
                        {songSuggestionsLoading ? (
                          <p className="px-3 py-3 text-sm text-slate-300">
                            Searching suggestions...
                          </p>
                        ) : songSuggestions.length > 0 ? (
                          <div className="divide-y divide-white/10">
                            {songSuggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.songTitle}:${suggestion.voicings.join(":")}:${suggestion.arrangerName}`}
                                type="button"
                                onClick={() => selectSongSuggestion(suggestion)}
                                className="w-full px-3 py-3 text-left hover:bg-cyan-300/10 focus:bg-cyan-300/10 focus:outline-none"
                              >
                                <span className="block font-semibold text-white">
                                  {suggestion.songTitle}
                                </span>
                                <span className="mt-1 block text-xs text-slate-300">
                                  {songSuggestionSubtitle(suggestion)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-3 py-3 text-sm text-slate-300">
                            No suggestion found.
                          </p>
                        )}
                      </div>
                      <div className="border-t border-cyan-300/20 bg-cyan-300/5 p-3">
                        <p className="text-xs font-semibold uppercase tracking-normal text-cyan-200">
                          Don&apos;t see your version?
                        </p>
                        <button
                          type="button"
                          onClick={openAddModalWithCurrentTitle}
                          className="mt-2 w-full rounded-lg bg-cyan-300 px-3 py-2 text-left text-sm font-bold text-slate-950 hover:bg-cyan-200"
                        >
                          Add &quot;{songTitle.trim()}&quot; manually
                        </button>
                        <p className="mt-2 text-xs leading-5 text-slate-300">
                          Choose the voicing, arranger, part, and confidence
                          yourself.
                        </p>
                      </div>
                    </div>
                  )}
                </label>

                {selectedSongSummaryOpen && (
                  <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-normal text-cyan-200">
                      {addSongSource === "suggestion"
                        ? "Selected song"
                        : "Adding your own song title"}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {songTitle.trim()}
                    </h3>
                    {addSongSource === "suggestion" ? (
                      <p className="mt-1 text-sm text-slate-300">
                        {voicing ? `${voicing} · ` : ""}
                        Arr. {arrangerDisplayName(arrangerName)}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-300">
                        Title: {songTitle.trim()}
                      </p>
                    )}
                    <p className="mt-3 text-sm text-cyan-100">
                      {suggestedVoicings && !voicing
                        ? "Next: choose the voicing you know."
                        : "Next: choose the part you sing and your confidence."}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-slate-300">Voicing</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {suggestedVoicings
                      ? "This suggestion has multiple voicings. Choose the version you know."
                      : "Suggestions are optional. You can always type your own title and choose the correct voicing."}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {voicingOptions.map((v) => (
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
                  {!voicing && (
                    <p className="mt-2 text-sm text-rose-200">
                      Choose a voicing to continue.
                    </p>
                  )}
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
                              aria-invalid={!row.part}
                              className={`${requiredCompactFieldClass} ${requiredFieldStateClass(
                                !row.part
                              )}`}
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
                              aria-invalid={!row.confidence}
                              className={`${requiredCompactFieldClass} ${requiredFieldStateClass(
                                !row.confidence
                              )}`}
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
