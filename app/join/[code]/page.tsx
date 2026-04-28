"use client";

import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { MatchCard } from "@/components/MatchCard";
import { trackEvent } from "@/lib/analytics";
import { findMatches, type MatchResult, type SingerEntry } from "@/lib/matching";
import {
  findParticipantByUserId,
  resolveParticipantForJoin,
} from "@/lib/sessionParticipantResolution";
import { applyParticipantChange } from "@/lib/sessionParticipantChanges";
import {
  type DbSession,
  type DbParticipant,
  getParticipants,
  getSessionByCode,
  removeParticipant,
  removeParticipantById,
  subscribeToSessionParticipants,
  upsertParticipant,
} from "@/lib/sessionStore";
import {
  applyProfileDisplayNameChange,
  getCurrentParticipantDisplayName,
  getParticipantDisplayName,
  getParticipantEntriesWithProfileNames,
  type ProfileDisplayNamesByUserId,
} from "@/lib/sessionParticipantDisplayName";
import {
  isSessionExpired,
  sessionExpirationLabel,
} from "@/lib/sessionExpiration";
import {
  clearActiveQuartet,
  clearActiveQuartetIfMatches,
  getActiveQuartet,
  type ActiveQuartet,
  setActiveQuartet,
} from "@/lib/activeQuartet";
import {
  getCurrentUser,
  getMyProfile,
  getProfilesByIds,
  subscribeToProfileDisplayNames,
} from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import {
  getRecentSungSongs,
  markSongAsSung,
  type SungSongEvent,
} from "@/lib/sungSongStore";

const matchSections = [
  {
    category: "ready",
    title: "Ready to Sing",
    description: "All required parts are covered.",
  },
  {
    category: "possible",
    title: "Possible",
    description: "Check details together before singing.",
  },
  {
    category: "one_part_missing",
    title: "One Part Missing",
    description: "Close matches that need one more singer or part.",
  },
] as const;

const MAX_QUARTET_PARTICIPANTS = 4;

type PersonalSongNote = {
  songTitle: string;
  voicing: SingerEntry["voicing"];
  notes: string;
};

function leftQuartetStorageKey(code: string) {
  return `left-quartet:${code}`;
}

function normalizeSongTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeOptionalText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

export default function JoinSessionPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const hasAutoJoined = useRef(false);
  const isRefreshingCurrentParticipant = useRef(false);
  const lastTrackedMatchesKey = useRef("");

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<DbSession | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [participants, setParticipants] = useState<DbParticipant[]>([]);
  const [profileDisplayNamesByUserId, setProfileDisplayNamesByUserId] =
    useState<ProfileDisplayNamesByUserId>({});
  const [personalSongNotes, setPersonalSongNotes] = useState<PersonalSongNote[]>(
    []
  );
  const [recentSungSongs, setRecentSungSongs] = useState<SungSongEvent[]>([]);
  const [markingSungKey, setMarkingSungKey] = useState("");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [leftQuartet, setLeftQuartet] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [joiningQuartet, setJoiningQuartet] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState("");
  const [pendingActiveQuartet, setPendingActiveQuartet] =
    useState<ActiveQuartet | null>(null);
  const [leavingCurrentQuartet, setLeavingCurrentQuartet] = useState(false);

  async function refreshParticipantProfileNames(data: DbParticipant[]) {
    try {
      const profileDisplayNames = await getProfilesByIds(
        data.map((participant) => participant.user_id)
      );
      setProfileDisplayNamesByUserId((current) => ({
        ...current,
        ...profileDisplayNames,
      }));
    } catch (err) {
      console.error("Could not refresh participant profile names", err);
    }
  }

  async function refreshParticipants(
    id: string,
    options: { showErrorMessage?: boolean } = {}
  ) {
    try {
      const data = await getParticipants(id);
      setParticipants(data);
      await refreshParticipantProfileNames(data);
      return data;
    } catch (err) {
      console.error(err);
      if (options.showErrorMessage ?? true) {
        setMessage("Could not refresh singers. Please try again.");
      }
      throw err;
    }
  }

  async function loadMyRepertoire() {
    const repertoire = await getMyRepertoire();
    setPersonalSongNotes(
      repertoire
        .filter((item) => item.notes?.trim())
        .map((item) => ({
          songTitle: item.song_title,
          voicing: item.voicing,
          notes: item.notes?.trim() ?? "",
        }))
    );

    return repertoire;
  }

  async function getMyEntries(name: string): Promise<SingerEntry[]> {
    const repertoire = await loadMyRepertoire();

    return repertoire.map((item) => ({
      userId: item.user_id,
      displayName: name,
      songTitle: item.song_title,
      voicing: item.voicing,
      arrangerName: item.arranger_name,
      partsKnown: item.parts_known,
      confidence: item.confidence,
    }));
  }

  async function joinSession(
    id = sessionId,
    name = displayName,
    userId = currentUserId,
    options: { clearLeftFlag?: boolean; successMessage?: string } = {}
  ) {
    if (joiningQuartet) return;

    if (session && isSessionExpired(session)) {
      setLoadError("This quartet has expired.");
      return;
    }

    if (!id || !name || !userId) {
      setMessage("Could not refresh yet. Wait for the quartet to finish loading.");
      return;
    }

    try {
      setJoiningQuartet(true);
      if (options.clearLeftFlag) {
        window.sessionStorage.removeItem(leftQuartetStorageKey(code));
        setLeftQuartet(false);
      }

      const existingParticipants = await refreshParticipants(id);

      const participantResolution = resolveParticipantForJoin(
        existingParticipants,
        userId,
        MAX_QUARTET_PARTICIPANTS
      );

      if (participantResolution.status === "full") {
        setMessage("This quartet already has four singers.");
        return;
      }

      const entries = await getMyEntries(name);
      const lastActivityAt = new Date().toISOString();

      await upsertParticipant(id, userId, name, entries, lastActivityAt);

      setActiveQuartet({ sessionId: id, code, joinedAt: lastActivityAt });
      setSession((current) =>
        current ? { ...current, last_activity_at: lastActivityAt } : current
      );
      const updatedParticipants = await refreshParticipants(id);

      if (participantResolution.status === "existing") {
        setMessage(
          options.successMessage ??
            `Updated ${name}'s repertoire with ${entries.length} songs.`
        );
        return;
      }

      trackEvent("quartet_joined", {
        session_id: id,
        participant_count: updatedParticipants.length,
        song_count: entries.length,
      });
      setMessage(`Joined as ${name} with ${entries.length} songs.`);
    } catch (err) {
      console.error(err);
      setMessage("Could not join quartet. Please try again.");
    } finally {
      setJoiningQuartet(false);
    }
  }

  async function refreshCurrentParticipantSongs({
    id = sessionId,
    name = currentParticipantDisplayName,
    userId = currentUserId,
    participantsToUse,
  }: {
    id?: string | null;
    name?: string;
    userId?: string;
    participantsToUse?: DbParticipant[];
  } = {}) {
    if (isRefreshingCurrentParticipant.current) return;

    if (!id || !userId || !name) {
      return;
    }

    try {
      isRefreshingCurrentParticipant.current = true;

      const currentParticipants =
        participantsToUse ?? (await refreshParticipants(id));
      const existingParticipant = findParticipantByUserId(
        currentParticipants,
        userId
      );

      if (!existingParticipant) return;

      const entries = await getMyEntries(name);
      const lastActivityAt = new Date().toISOString();
      await upsertParticipant(id, userId, name, entries, lastActivityAt);

      await refreshParticipants(id);
      setActiveQuartet({ sessionId: id, code, joinedAt: lastActivityAt });
      setSession((current) =>
        current ? { ...current, last_activity_at: lastActivityAt } : current
      );
    } catch (err) {
      console.error("Could not update returning participant repertoire", err);
    } finally {
      isRefreshingCurrentParticipant.current = false;
    }
  }

  async function leaveQuartet() {
    if (!sessionId || !currentUserId) {
      setMessage("Could not leave yet. Wait for the quartet to finish loading.");
      return;
    }

    setLeaving(true);
    setMessage("");

    try {
      await removeParticipant(sessionId, currentUserId);
      clearActiveQuartetIfMatches(sessionId);
      window.sessionStorage.setItem(leftQuartetStorageKey(code), "true");
      trackEvent("quartet_left", {
        session_id: sessionId,
        participant_count: Math.max(0, participants.length - 1),
      });
      window.location.href = "/?leftQuartet=1";
    } catch (err) {
      console.error(err);
      setMessage("Could not leave quartet. Check your connection and try again.");
      setLeaving(false);
    }
  }

  async function removeQuartetParticipant(participant: DbParticipant) {
    if (!sessionId || !currentUserId) {
      setMessage("Could not remove that singer yet. Wait for the quartet to finish loading.");
      return;
    }

    if (participant.user_id === currentUserId) return;

    const participantName = getParticipantDisplayName(
      participant,
      profileDisplayNamesByUserId
    );
    const confirmed = window.confirm(
      `Remove ${participantName} from this quartet?`
    );

    if (!confirmed) return;

    setRemovingParticipantId(participant.id);
    setMessage("");

    try {
      await removeParticipantById(sessionId, participant.id);
      await refreshParticipants(sessionId, { showErrorMessage: false });
      trackEvent("quartet_member_removed", {
        session_id: sessionId,
        participant_count: Math.max(0, participants.length - 1),
      });
    } catch (err) {
      console.error(err);
      setMessage("Could not remove that singer. Check your connection and try again.");
    } finally {
      setRemovingParticipantId("");
    }
  }

  async function rejoinQuartet() {
    await joinSession(sessionId, currentParticipantDisplayName, currentUserId, {
      clearLeftFlag: true,
    });
  }

  async function copyJoinLink() {
    const joinUrl = `${window.location.origin}/join/${code}`;

    try {
      await window.navigator.clipboard.writeText(joinUrl);
      setCopyMessage("Join link copied.");
    } catch (err) {
      console.error(err);
      setCopyMessage("Could not copy automatically. Share the code instead.");
    }
  }

  async function copyJoinCode() {
    try {
      await window.navigator.clipboard.writeText(code);
      setCopyMessage("Quartet code copied.");
    } catch (err) {
      console.error(err);
      setCopyMessage("Could not copy automatically. You can still share the code.");
    }
  }

  async function leaveCurrentAndJoinThisQuartet() {
    if (!pendingActiveQuartet || !currentUserId || !sessionId) {
      setMessage("Could not continue yet. Wait for this quartet to finish loading.");
      return;
    }

    setLeavingCurrentQuartet(true);
    setMessage("");

    try {
      await removeParticipant(pendingActiveQuartet.sessionId, currentUserId);
      trackEvent("quartet_left", {
        session_id: pendingActiveQuartet.sessionId,
      });
      clearActiveQuartet();
      setPendingActiveQuartet(null);
      await joinSession(sessionId, displayName, currentUserId, {
        clearLeftFlag: true,
      });
    } catch (err) {
      console.error(err);
      setMessage(
        "Could not leave your current quartet. Check your connection and try again."
      );
    } finally {
      setLeavingCurrentQuartet(false);
    }
  }

  async function refreshRecentSungSongs() {
    try {
      const events = await getRecentSungSongs();
      setRecentSungSongs(events);
    } catch (err) {
      console.error(err);
      setMessage("Could not refresh recent songs. Matches still work.");
    }
  }

  function matchKey(match: MatchResult) {
    return `${normalizeSongTitle(match.songTitle)}:${match.voicing}`;
  }

  function toggleExpandedMatch(matchId: string) {
    setExpandedMatchId((currentMatchId) =>
      currentMatchId === matchId ? null : matchId
    );
  }

  async function markMatchAsSung(match: MatchResult) {
    if (!sessionId) {
      setMessage("Could not mark that yet. Wait for the quartet to finish loading.");
      return;
    }

    const key = matchKey(match);
    setMarkingSungKey(key);
    setMessage("");

    try {
      await markSongAsSung({
        sessionId,
        songTitle: match.songTitle,
        voicing: match.voicing,
        arrangerName: match.arrangerNames.join(", ") || undefined,
      });
      await refreshRecentSungSongs();
      setMessage(`Marked "${match.songTitle}" as sung.`);
    } catch (err) {
      console.error(err);
      setMessage("Could not mark that song as sung. Check your connection and try again.");
    } finally {
      setMarkingSungKey("");
    }
  }

  useEffect(() => {
    if (!sessionId) return;

    return subscribeToSessionParticipants(sessionId, (payload) => {
      setParticipants((currentParticipants) => {
        const updatedParticipants = applyParticipantChange(
          currentParticipants,
          payload,
          sessionId
        );
        void refreshParticipantProfileNames(updatedParticipants);
        return updatedParticipants;
      });
      void refreshParticipants(sessionId, { showErrorMessage: false }).catch(
        () => undefined
      );
    });
  }, [sessionId]);

  const participantUserIds = Array.from(
    new Set(participants.map((participant) => participant.user_id))
  ).sort();
  const participantUserIdsKey = participantUserIds.join(":");

  useEffect(() => {
    if (!participantUserIdsKey) return;

    return subscribeToProfileDisplayNames(participantUserIds, (payload) => {
      setProfileDisplayNamesByUserId((currentProfileDisplayNames) =>
        applyProfileDisplayNameChange(
          currentProfileDisplayNames,
          payload,
          participantUserIds
        )
      );
    });
  }, [participantUserIdsKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    async function load() {
      try {
        const user = await getCurrentUser();

        if (!user) {
          window.location.href = `/login?redirect=/join/${code}`;
          return;
        }

        const profile = await getMyProfile();

        if (!profile?.display_name) {
          window.location.href = "/settings";
          return;
        }

        const session = await getSessionByCode(code);

        if (!session) {
          setLoadError(
            "That quartet code was not found. Check the code and try again."
          );
          return;
        }

        if (isSessionExpired(session)) {
          setSession(session);
          clearActiveQuartetIfMatches(session.id);
          setLoadError("This quartet has expired.");
          return;
        }

        setCurrentUserId(user.id);
        setDisplayName(profile.display_name);
        setProfileDisplayNamesByUserId((current) => ({
          ...current,
          [user.id]: profile.display_name,
        }));
        setSessionId(session.id);
        setSession(session);
        try {
          await refreshRecentSungSongs();
        } catch {
          // refreshRecentSungSongs handles its own message.
        }

        const joinUrl = `${window.location.origin}/join/${code}`;
        try {
          const qr = await QRCode.toDataURL(joinUrl);
          setQrUrl(qr);
        } catch (err) {
          console.error(err);
          setCopyMessage("QR code unavailable. Share the code or link instead.");
        }

        const hasLeftQuartet =
          window.sessionStorage.getItem(leftQuartetStorageKey(code)) === "true";
        setLeftQuartet(hasLeftQuartet);

        const currentParticipants = await refreshParticipants(session.id);

        const existingParticipant = findParticipantByUserId(
          currentParticipants,
          user.id
        );
        const alreadyJoined = Boolean(existingParticipant);

        const activeQuartet = getActiveQuartet();
        if (
          !alreadyJoined &&
          activeQuartet &&
          activeQuartet.sessionId !== session.id &&
          !hasLeftQuartet
        ) {
          setPendingActiveQuartet(activeQuartet);
          setMessage("");
          return;
        }

        if (alreadyJoined) {
          if (hasLeftQuartet) {
            window.sessionStorage.removeItem(leftQuartetStorageKey(code));
            setLeftQuartet(false);
          }

          const lastActivityAt = new Date().toISOString();
          await refreshCurrentParticipantSongs({
            id: session.id,
            name: profile.display_name,
            userId: user.id,
            participantsToUse: currentParticipants,
          });

          setActiveQuartet({
            sessionId: session.id,
            code,
            joinedAt: lastActivityAt,
          });
          setMessage((current) =>
            current || `You are in this quartet as ${profile.display_name}.`
          );
        } else if (!hasAutoJoined.current && !hasLeftQuartet) {
          hasAutoJoined.current = true;
          await joinSession(session.id, profile.display_name, user.id);
        } else if (hasLeftQuartet) {
          clearActiveQuartetIfMatches(session.id);
          setMessage("You left this quartet.");
        }
      } catch (err) {
        console.error(err);
        setLoadError(
          "Could not load this quartet. Check your connection and try again."
        );
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      window.clearInterval(timer);
    };
  }, [code]);

  const allEntries: SingerEntry[] = getParticipantEntriesWithProfileNames(
    participants,
    profileDisplayNamesByUserId
  );
  const matches = findMatches(allEntries);
  const groupedMatches = matchSections.map((section) => ({
    ...section,
    matches: matches.filter((match) => match.category === section.category),
  }));
  const readyMatchCount = groupedMatches.find(
    (section) => section.category === "ready"
  )?.matches.length ?? 0;
  const possibleMatchCount = groupedMatches.find(
    (section) => section.category === "possible"
  )?.matches.length ?? 0;
  const onePartMissingCount = groupedMatches.find(
    (section) => section.category === "one_part_missing"
  )?.matches.length ?? 0;
  const quartetExpired = session ? isSessionExpired(session, now) : false;
  const expirationLabel = session ? sessionExpirationLabel(session, now) : "";
  const currentParticipantDisplayName = getCurrentParticipantDisplayName(
    participants,
    currentUserId,
    profileDisplayNamesByUserId,
    displayName
  );
  const isCurrentUserParticipant = Boolean(
    findParticipantByUserId(participants, currentUserId)
  );
  const openSingerSlots = Math.max(
    0,
    MAX_QUARTET_PARTICIPANTS - participants.length
  );
  const isQuartetFull = participants.length >= MAX_QUARTET_PARTICIPANTS;
  const showJoinInfo =
    Boolean(session) &&
    !quartetExpired &&
    !pendingActiveQuartet &&
    !isQuartetFull;
  const canManageParticipants = isCurrentUserParticipant && !leftQuartet;

  useEffect(() => {
    if (!sessionId || loading || loadError || quartetExpired) return;

    const timer = window.setInterval(() => {
      void refreshParticipants(sessionId, { showErrorMessage: false }).catch(
        () => undefined
      );
    }, 5000);

    return () => window.clearInterval(timer);
  }, [loading, loadError, quartetExpired, sessionId]);

  useEffect(() => {
    if (
      loading ||
      !sessionId ||
      !currentUserId ||
      !currentParticipantDisplayName ||
      loadError ||
      quartetExpired ||
      pendingActiveQuartet ||
      leftQuartet
    ) {
      return;
    }

    function refreshOnReturn() {
      if (document.visibilityState === "hidden") return;
      void refreshCurrentParticipantSongs();
    }

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [
    currentParticipantDisplayName,
    currentUserId,
    leftQuartet,
    loadError,
    loading,
    pendingActiveQuartet,
    quartetExpired,
    sessionId,
  ]);

  useEffect(() => {
    if (
      loading ||
      !sessionId ||
      loadError ||
      quartetExpired ||
      pendingActiveQuartet
    ) {
      return;
    }

    const trackingKey = [
      sessionId,
      participants.length,
      matches.length,
      readyMatchCount,
      possibleMatchCount,
      onePartMissingCount,
    ].join(":");

    if (lastTrackedMatchesKey.current === trackingKey) return;

    lastTrackedMatchesKey.current = trackingKey;
    trackEvent("quartet_matches_viewed", {
      session_id: sessionId,
      participant_count: participants.length,
      match_count: matches.length,
      ready_match_count: readyMatchCount,
      possible_match_count: possibleMatchCount,
      one_part_missing_count: onePartMissingCount,
    });
  }, [
    loading,
    loadError,
    matches.length,
    onePartMissingCount,
    participants.length,
    pendingActiveQuartet,
    possibleMatchCount,
    quartetExpired,
    readyMatchCount,
    sessionId,
  ]);

  function notesForMatch(match: MatchResult) {
    const matchTitle = normalizeSongTitle(match.songTitle);

    return personalSongNotes
      .filter(
        (note) =>
          note.voicing === match.voicing &&
          normalizeSongTitle(note.songTitle) === matchTitle
      )
      .map((note) => note.notes);
  }

  function wasRecentlySung(match: MatchResult) {
    const matchTitle = normalizeSongTitle(match.songTitle);
    const matchArrangers = match.arrangerNames.map(normalizeOptionalText);

    return recentSungSongs.some(
      (event) => {
        if (event.voicing !== match.voicing) return false;
        if (normalizeSongTitle(event.song_title) !== matchTitle) return false;

        const eventArranger = normalizeOptionalText(event.arranger_name);
        if (!eventArranger || matchArrangers.length === 0) return true;

        return matchArrangers.includes(eventArranger);
      }
    );
  }

  function renderParticipantRow(participant: DbParticipant) {
    const isCurrentParticipant = participant.user_id === currentUserId;

    return (
      <div
        key={participant.id}
        className="rounded-xl border border-white/10 bg-white/10 p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">
              {getParticipantDisplayName(
                participant,
                profileDisplayNamesByUserId
              )}
            </p>
            <p className="text-sm text-slate-300">
              {participant.repertoire.length} songs loaded
            </p>
          </div>

          {canManageParticipants && (
            isCurrentParticipant ? (
              <a
                href="/settings"
                className="w-fit rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10"
              >
                Change my display name
              </a>
            ) : (
              <button
                type="button"
                onClick={() => removeQuartetParticipant(participant)}
                disabled={Boolean(removingParticipantId)}
                className="w-fit rounded-lg bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/20 disabled:opacity-40"
              >
                {removingParticipantId === participant.id
                  ? "Removing..."
                  : "Remove from quartet"}
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Joining quartet...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <AppNav />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-4xl font-bold">Quartet {code}</h1>
          {expirationLabel && (
            <p className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-semibold text-slate-300">
              {expirationLabel}
            </p>
          )}
        </div>

        {(loadError || quartetExpired) && (
          <div className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-6">
            <p className="font-semibold text-rose-100">
              {quartetExpired ? "This quartet has expired." : loadError}
            </p>
            {quartetExpired && (
              <p className="mt-2 text-sm text-rose-100">
                Start a new quartet to make a fresh code.
              </p>
            )}
            <a
              href={quartetExpired ? "/session" : "/join"}
              className="mt-4 inline-block rounded-xl bg-rose-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white"
            >
              {quartetExpired ? "Start a new quartet" : "Enter a different code"}
            </a>
            {!quartetExpired && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ml-0 mt-3 rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700 sm:ml-3"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {!loadError && !quartetExpired && message && (
          <p className="mt-4 rounded-xl bg-white/10 p-4 text-slate-200">
            {message}
          </p>
        )}

        {!loadError && !quartetExpired && pendingActiveQuartet && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-quartet-title"
            className="mt-8 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-6"
          >
            <h2 id="active-quartet-title" className="text-2xl font-semibold">
              You are already in a quartet
            </h2>
            <p className="mt-2 text-slate-200">
              Return to quartet {pendingActiveQuartet.code}, or leave it before
              joining quartet {code}.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={`/join/${pendingActiveQuartet.code}`}
                className="rounded-xl bg-cyan-300 px-5 py-3 text-center font-semibold text-slate-950 hover:bg-cyan-200"
              >
                Return to current quartet
              </a>
              <button
                type="button"
                onClick={leaveCurrentAndJoinThisQuartet}
                disabled={leavingCurrentQuartet}
                className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                {leavingCurrentQuartet
                  ? "Leaving..."
                  : "Leave current quartet and continue"}
              </button>
            </div>
          </div>
        )}

        {!loadError && !quartetExpired && !pendingActiveQuartet && (
          <>
            {showJoinInfo && (
              <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  {qrUrl && (
                    <img
                      src={qrUrl}
                      alt="QR code for joining this quartet"
                      className="mx-auto w-44 rounded-xl bg-white p-3 md:mx-0"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold uppercase text-cyan-200">
                      Waiting for singers
                    </p>
                    <p className="mt-2 text-5xl font-bold tracking-widest text-white">
                      {code}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {openSingerSlots} {openSingerSlots === 1 ? "spot" : "spots"} open.
                      Share this code or QR link with singers nearby.
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={copyJoinCode}
                        className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
                      >
                        Copy code
                      </button>
                      <button
                        type="button"
                        onClick={copyJoinLink}
                        className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Copy join link
                      </button>
                    </div>

                    {copyMessage && (
                      <p className="mt-2 text-sm text-cyan-100">{copyMessage}</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {isQuartetFull && (
              <section className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Quartet is full
                    </p>
                    {isCurrentUserParticipant ? (
                      <p className="mt-1 text-sm text-slate-400">
                        You are singing as{" "}
                        <span className="font-semibold text-cyan-200">
                          {currentParticipantDisplayName}
                        </span>
                        .
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-400">
                        This quartet already has four singers.
                      </p>
                    )}
                  </div>

                  {isCurrentUserParticipant && (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="/repertoire"
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/10"
                      >
                        Edit repertoire
                      </a>
                      <button
                        onClick={leaveQuartet}
                        disabled={leaving || !sessionId || !currentUserId}
                        className="rounded-xl bg-rose-200 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-100 disabled:opacity-40"
                      >
                        {leaving ? "Leaving..." : "Leave quartet"}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {!isQuartetFull && (
              <>
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-6">
                  {leftQuartet ? (
                    <>
                      <p className="text-slate-300">
                        You are not currently in this quartet.
                      </p>
                      <button
                        onClick={rejoinQuartet}
                        disabled={
                          joiningQuartet ||
                          !sessionId ||
                          !currentParticipantDisplayName ||
                          !currentUserId ||
                          quartetExpired
                        }
                        className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                      >
                        {joiningQuartet ? "Joining..." : "Join this quartet again"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-300">You are in this quartet as:</p>
                      <p className="mt-1 text-2xl font-bold text-cyan-300">
                        {currentParticipantDisplayName}
                      </p>

                      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          onClick={leaveQuartet}
                          disabled={leaving || !sessionId || !currentUserId}
                          className="rounded-xl bg-rose-200 px-5 py-3 font-semibold text-slate-950 hover:bg-rose-100 disabled:opacity-40"
                        >
                          {leaving ? "Leaving..." : "Leave quartet"}
                        </button>

                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          <a
                            href="/repertoire"
                            className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                          >
                            Edit repertoire
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-8">
                  <h2 className="text-2xl font-semibold">Participants</h2>

                  <div className="mt-4 space-y-3">
                    {participants.length === 0 && (
                      <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                        No singers have joined yet.
                      </p>
                    )}

                    {participants.map(renderParticipantRow)}
                  </div>
                </div>
              </>
            )}

            <div className={isQuartetFull ? "mt-6" : "mt-10"}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Matches</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Compact rows stay ranked within each group.
                  </p>
                </div>
                {matches.length > 0 && (
                  <p className="text-sm font-semibold text-cyan-300">
                    {matches.length} total
                  </p>
                )}
              </div>

              <div className="mt-4 space-y-5">
                {matches.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                    No matches yet. Add more singers or repertoire.
                  </p>
                )}

                {groupedMatches.map(
                  (section) =>
                    section.matches.length > 0 && (
                      <section
                        key={section.category}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-100">
                              {section.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-300">
                              {section.description}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200">
                            {section.matches.length}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {section.matches.map((match) => {
                            const id = matchKey(match);

                            return (
                              <MatchCard
                                key={id}
                                match={match}
                                personalNotes={notesForMatch(match)}
                                isExpanded={expandedMatchId === id}
                                isRecentlySung={wasRecentlySung(match)}
                                isMarkingSung={markingSungKey === id}
                                onToggle={() => toggleExpandedMatch(id)}
                                onMarkAsSung={() => markMatchAsSung(match)}
                              />
                            );
                          })}
                        </div>
                      </section>
                    )
                )}
              </div>
            </div>

            {isQuartetFull && (
              <details className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
                  Quartet details
                </summary>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-400">
                      Code {code} is still available if someone needs the link.
                    </p>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={copyJoinCode}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                      >
                        Copy code
                      </button>
                      <button
                        type="button"
                        onClick={copyJoinLink}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>

                  {copyMessage && (
                    <p className="mt-2 text-sm text-slate-300">{copyMessage}</p>
                  )}

                  <div className="mt-6">
                    <h2 className="text-lg font-semibold">Participants</h2>

                    <div className="mt-4 space-y-3">
                      {participants.map(renderParticipantRow)}
                    </div>
                  </div>
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </main>
  );
}
