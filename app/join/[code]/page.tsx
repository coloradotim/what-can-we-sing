"use client";

import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { MatchCard } from "@/components/MatchCard";
import { QuartetActionConfirmation } from "@/components/QuartetActionConfirmation";
import { noArrangerEnteredLabel } from "@/lib/arrangerDisplay";
import { trackEvent } from "@/lib/analytics";
import {
  conversationStartersIntro,
  shouldShowConversationStarters,
} from "@/lib/conversationStarters";
import { intentionalJoinStorageKey } from "@/lib/joinIntent";
import { resolveCurrentUserRepertoireForMarkAsSung } from "@/lib/markAsSung";
import {
  findConversationStarters,
  findMatches,
  type ConversationStarter,
  type MatchResult,
  type Part,
  type SingerEntry,
} from "@/lib/matching";
import {
  functionalPartName,
  partAbbreviation,
  voicingDisplayLabel,
} from "@/lib/partAbbreviations";
import {
  findParticipantByUserId,
  resolveParticipantForJoin,
} from "@/lib/sessionParticipantResolution";
import { applyParticipantChange } from "@/lib/sessionParticipantChanges";
import { didCurrentParticipantGetRemoved } from "@/lib/sessionParticipantRemoval";
import {
  type DbSession,
  type DbParticipant,
  getParticipants,
  getSessionByCode,
  QuartetFullError,
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
import {
  getMyRepertoire,
  markRepertoireItemAsSung,
} from "@/lib/repertoireStore";
import { buildParticipantEntries } from "@/lib/participantEntries";
import {
  getRecentSungSongs,
  type SungSongEvent,
} from "@/lib/sungSongStore";
import { compactTitleKey } from "@/lib/songSuggestionTitle";

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
const quartetFullMessage =
  "This quartet is already full. Ask the group to start a new quartet.";

type PersonalSongNote = {
  songTitle: string;
  voicing: SingerEntry["voicing"];
  notes: string;
};

type QuartetStatusMessageKind = "transient" | "persistent" | "success" | "error";

function leftQuartetStorageKey(code: string) {
  return `left-quartet:${code}`;
}

function normalizeSongTitle(title: string) {
  return compactTitleKey(title);
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
  const participantsRef = useRef<DbParticipant[]>([]);
  const messageTimeoutRef = useRef<number | null>(null);
  const sungCelebrationTimeoutRef = useRef<number | null>(null);

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
  const [celebratingSungKey, setCelebratingSungKey] = useState("");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] =
    useState<QuartetStatusMessageKind>("persistent");
  const [copyMessage, setCopyMessage] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [leftQuartet, setLeftQuartet] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [joiningQuartet, setJoiningQuartet] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState("");
  const [participantToRemove, setParticipantToRemove] =
    useState<DbParticipant | null>(null);
  const [pendingActiveQuartet, setPendingActiveQuartet] =
    useState<ActiveQuartet | null>(null);
  const [leavingCurrentQuartet, setLeavingCurrentQuartet] = useState(false);

  function setTrackedParticipants(data: DbParticipant[]) {
    participantsRef.current = data;
    setParticipants(data);
  }

  function clearStatusMessage() {
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }

    setMessage("");
  }

  function showStatusMessage(
    text: string,
    kind: QuartetStatusMessageKind = "persistent",
    durationMs = 5000
  ) {
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }

    setMessage(text);
    setMessageKind(kind);

    if (kind === "transient" || kind === "success") {
      messageTimeoutRef.current = window.setTimeout(() => {
        setMessage((currentMessage) =>
          currentMessage === text ? "" : currentMessage
        );
        messageTimeoutRef.current = null;
      }, durationMs);
    }
  }

  function markCurrentUserRemovedFromQuartet(id: string) {
    if (
      window.sessionStorage.getItem(leftQuartetStorageKey(code)) === "true"
    ) {
      return;
    }

    window.sessionStorage.setItem(leftQuartetStorageKey(code), "true");
    window.sessionStorage.removeItem(intentionalJoinStorageKey(code));
    clearActiveQuartetIfMatches(id);
    setIsManageOpen(false);
    setLeftQuartet(true);
    setPendingActiveQuartet(null);
    window.location.href = "/join?removed=1";
  }

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
      const previousParticipants = participantsRef.current;
      setTrackedParticipants(data);
      if (
        id === sessionId &&
        didCurrentParticipantGetRemoved(
          previousParticipants,
          data,
          currentUserId
        )
      ) {
        markCurrentUserRemovedFromQuartet(id);
      }
      await refreshParticipantProfileNames(data);
      return data;
    } catch (err) {
      console.error(err);
      if (options.showErrorMessage ?? true) {
        showStatusMessage("Could not refresh singers. Please try again.", "error");
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
    return buildParticipantEntries(name, repertoire);
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
      showStatusMessage(
        "Could not refresh yet. Wait for the quartet to finish loading.",
        "error"
      );
      return;
    }

    trackEvent("quartet_join_attempted", {
      session_id: id,
    });

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
        trackEvent("quartet_join_failed", {
          session_id: id,
          reason: "quartet_full",
          participant_count: existingParticipants.length,
        });
        trackEvent("quartet_full", {
          session_id: id,
          participant_count: existingParticipants.length,
        });
        setLoadError(quartetFullMessage);
        showStatusMessage(quartetFullMessage, "error");
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
        trackEvent("quartet_rejoined", {
          session_id: id,
          participant_count: updatedParticipants.length,
          song_count: entries.length,
        });
        showStatusMessage(
          options.successMessage ??
            `Updated ${name}'s saved songs with ${entries.length} songs.`,
          "transient"
        );
        return;
      }

      trackEvent("quartet_joined", {
        session_id: id,
        participant_count: updatedParticipants.length,
        song_count: entries.length,
      });
      if (updatedParticipants.length >= MAX_QUARTET_PARTICIPANTS) {
        trackEvent("quartet_full", {
          session_id: id,
          participant_count: updatedParticipants.length,
        });
      }
      showStatusMessage(
        `Joined as ${name} with ${entries.length} songs.`,
        "transient"
      );
    } catch (err) {
      console.error(err);
      if (err instanceof QuartetFullError) {
        trackEvent("quartet_join_failed", {
          session_id: id,
          reason: "quartet_full",
        });
        setLoadError(quartetFullMessage);
        showStatusMessage(quartetFullMessage, "error");
        return;
      }

      trackEvent("quartet_join_failed", {
        session_id: id,
        reason: "write_failed",
      });
      showStatusMessage("Could not join quartet. Please try again.", "error");
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
    if (!sessionId) {
      showStatusMessage(
        "Could not leave yet. Wait for the quartet to finish loading.",
        "error"
      );
      return false;
    }

    trackEvent("quartet_leave_confirmed", {
      session_id: sessionId,
      source: "quartet_page",
    });
    setLeaving(true);
    clearStatusMessage();

    try {
      const userId = currentUserId || (await getCurrentUser())?.id;

      if (!userId) {
        throw new Error("You must be logged in to leave a quartet.");
      }

      await removeParticipant(sessionId, userId);
      clearActiveQuartetIfMatches(sessionId);
      window.sessionStorage.setItem(leftQuartetStorageKey(code), "true");
      trackEvent("quartet_left", {
        session_id: sessionId,
        participant_count: Math.max(0, participants.length - 1),
      });
      window.location.href = "/?leftQuartet=1";
      return true;
    } catch (err) {
      console.error(err);
      trackEvent("quartet_leave_failed", {
        session_id: sessionId,
        source: "quartet_page",
      });
      showStatusMessage(
        "Could not leave quartet. Check your connection and try again.",
        "error"
      );
      setLeaving(false);
      return false;
    }
  }

  function requestLeaveQuartet() {
    clearStatusMessage();
    if (sessionId) {
      trackEvent("quartet_leave_clicked", {
        session_id: sessionId,
        source: "quartet_page",
      });
    }
    setIsManageOpen(false);
    setShowLeaveConfirmation(true);
  }

  async function confirmLeaveQuartet() {
    const didLeave = await leaveQuartet();
    if (!didLeave) {
      setShowLeaveConfirmation(false);
    }
  }

  async function removeQuartetParticipant(participant: DbParticipant) {
    if (!sessionId || !currentUserId) {
      showStatusMessage(
        "Could not remove that singer yet. Wait for the quartet to finish loading.",
        "error"
      );
      return;
    }

    if (participant.user_id === currentUserId) {
      requestLeaveQuartet();
      return;
    }

    clearStatusMessage();
    setParticipantToRemove(participant);
  }

  async function confirmRemoveQuartetParticipant() {
    if (!sessionId || !participantToRemove) return;

    const participant = participantToRemove;
    const participantName = getParticipantDisplayName(
      participant,
      profileDisplayNamesByUserId
    );
    setRemovingParticipantId(participant.id);
    clearStatusMessage();

    try {
      await removeParticipantById(sessionId, participant.id);
      const updatedParticipants = await refreshParticipants(sessionId, {
        showErrorMessage: false,
      });
      trackEvent("quartet_member_removed", {
        session_id: sessionId,
        participant_count: updatedParticipants.length,
      });
      showStatusMessage(
        `${participantName} was removed from the quartet.`,
        "transient"
      );
      setParticipantToRemove(null);
    } catch (err) {
      console.error(err);
      showStatusMessage(
        "Could not remove that singer. Check your connection and try again.",
        "error"
      );
      setParticipantToRemove(null);
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
    const joinUrl = `${window.location.origin}/join/${code}?intent=join`;

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
    if (!pendingActiveQuartet || !sessionId) {
      showStatusMessage(
        "Could not continue yet. Wait for this quartet to finish loading.",
        "error"
      );
      return;
    }

    trackEvent("quartet_leave_clicked", {
      session_id: pendingActiveQuartet.sessionId,
      source: "join_different_quartet",
    });
    setLeavingCurrentQuartet(true);
    clearStatusMessage();

    try {
      const userId = currentUserId || (await getCurrentUser())?.id;

      if (!userId) {
        throw new Error("You must be logged in to leave a quartet.");
      }

      trackEvent("quartet_leave_confirmed", {
        session_id: pendingActiveQuartet.sessionId,
        source: "join_different_quartet",
      });
      await removeParticipant(pendingActiveQuartet.sessionId, userId);
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
      trackEvent("quartet_leave_failed", {
        session_id: pendingActiveQuartet.sessionId,
        source: "join_different_quartet",
      });
      showStatusMessage(
        "Could not leave your current quartet. Check your connection and try again.",
        "error"
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
      showStatusMessage(
        "Could not refresh recent songs. Matches still work.",
        "transient"
      );
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
      showStatusMessage(
        "Could not mark that yet. Wait for the quartet to finish loading.",
        "error"
      );
      return;
    }

    const key = matchKey(match);
    setMarkingSungKey(key);
    clearStatusMessage();

    try {
      const resolution = resolveCurrentUserRepertoireForMarkAsSung(
        match,
        currentUserId
      );

      if (resolution.status === "no_matching_entry") {
        showStatusMessage(
          "This match does not include one of your assigned song parts.",
          "error"
        );
        return;
      }

      if (resolution.status === "missing_repertoire_id") {
        showStatusMessage(
          "Refresh your quartet songs before marking this as sung.",
          "error"
        );
        return;
      }

      if (resolution.status === "ambiguous") {
        showStatusMessage(
          "This match includes more than one of your saved song entries. Update the exact song from My Songs.",
          "error"
        );
        return;
      }

      await markRepertoireItemAsSung(resolution.repertoireId, sessionId);
      trackEvent("song_marked_sung", {
        session_id: sessionId,
        match_category: match.category,
        voicing: match.voicing,
      });
      await refreshRecentSungSongs();
      if (sungCelebrationTimeoutRef.current) {
        window.clearTimeout(sungCelebrationTimeoutRef.current);
      }
      setCelebratingSungKey(key);
      sungCelebrationTimeoutRef.current = window.setTimeout(() => {
        setCelebratingSungKey((currentKey) =>
          currentKey === key ? "" : currentKey
        );
        sungCelebrationTimeoutRef.current = null;
      }, 1800);
      showStatusMessage("Nice — marked as sung.", "success", 3000);
    } catch (err) {
      console.error(err);
      trackEvent("song_mark_sung_failed", {
        session_id: sessionId,
        match_category: match.category,
        voicing: match.voicing,
      });
      showStatusMessage(
        "Could not mark that song as sung. Check your connection and try again.",
        "error"
      );
    } finally {
      setMarkingSungKey("");
    }
  }

  useEffect(() => {
    if (!sessionId) return;

    return subscribeToSessionParticipants(sessionId, (payload) => {
      const previousParticipants = participantsRef.current;
      const updatedParticipants = applyParticipantChange(
        previousParticipants,
        payload,
        sessionId
      );
      setTrackedParticipants(updatedParticipants);
      if (
        didCurrentParticipantGetRemoved(
          previousParticipants,
          updatedParticipants,
          currentUserId
        )
      ) {
        markCurrentUserRemovedFromQuartet(sessionId);
      }
      void refreshParticipantProfileNames(updatedParticipants);
      void refreshParticipants(sessionId, { showErrorMessage: false }).catch(
        () => undefined
      );
    });
  }, [currentUserId, sessionId]);

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

        const joinUrl = `${window.location.origin}/join/${code}?intent=join`;
        try {
          const qr = await QRCode.toDataURL(joinUrl);
          setQrUrl(qr);
        } catch (err) {
          console.error(err);
          setCopyMessage("QR code unavailable. Share the code or link instead.");
        }

        const hasLeftQuartet =
          window.sessionStorage.getItem(leftQuartetStorageKey(code)) === "true";
        const pageIntent = new URLSearchParams(window.location.search).get(
          "intent"
        );
        const hasIntentionalJoin =
          window.sessionStorage.getItem(intentionalJoinStorageKey(code)) ===
            "true" || pageIntent === "join";

        if (hasIntentionalJoin) {
          window.sessionStorage.removeItem(intentionalJoinStorageKey(code));
          window.sessionStorage.removeItem(leftQuartetStorageKey(code));
          window.history.replaceState(null, "", `/join/${code}`);
        }

        const shouldTreatAsLeft = hasLeftQuartet && !hasIntentionalJoin;
        setLeftQuartet(shouldTreatAsLeft);

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
          !shouldTreatAsLeft
        ) {
          setPendingActiveQuartet(activeQuartet);
          clearStatusMessage();
          return;
        }

        if (
          !alreadyJoined &&
          activeQuartet?.sessionId === session.id &&
          !shouldTreatAsLeft
        ) {
          clearActiveQuartetIfMatches(session.id);
          window.location.href = "/join?removed=1";
          return;
        }

        if (alreadyJoined) {
          if (shouldTreatAsLeft) {
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
          if (!message) {
            showStatusMessage(
              `You are in this quartet as ${profile.display_name}.`,
              "transient"
            );
          }
        } else if (!hasAutoJoined.current && !shouldTreatAsLeft) {
          hasAutoJoined.current = true;
          await joinSession(session.id, profile.display_name, user.id);
        } else if (shouldTreatAsLeft) {
          clearActiveQuartetIfMatches(session.id);
          showStatusMessage("You left this quartet.");
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
  const showConversationStartersSection =
    shouldShowConversationStarters(readyMatchCount);
  const conversationStarters = showConversationStartersSection
    ? findConversationStarters(allEntries)
    : [];
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
  const orderedParticipants = [...participants].sort((a, b) => {
    if (a.user_id === currentUserId) return -1;
    if (b.user_id === currentUserId) return 1;
    return getParticipantDisplayName(a, profileDisplayNamesByUserId).localeCompare(
      getParticipantDisplayName(b, profileDisplayNamesByUserId),
      undefined,
      { sensitivity: "base" }
    );
  });
  const openSingerSlots = Math.max(
    0,
    MAX_QUARTET_PARTICIPANTS - participants.length
  );
  const isQuartetFull = participants.length >= MAX_QUARTET_PARTICIPANTS;
  const shouldShowQuartetResults = isCurrentUserParticipant || !isQuartetFull;
  const showManageButton =
    Boolean(session) &&
    isQuartetFull &&
    participants.length > 0 &&
    !leftQuartet &&
    !loadError &&
    !quartetExpired &&
    !pendingActiveQuartet;
  const showJoinInfo =
    Boolean(session) &&
    !quartetExpired &&
    !pendingActiveQuartet &&
    !isQuartetFull;
  const canManageParticipants = isCurrentUserParticipant && !leftQuartet;

  useEffect(() => {
    if (isQuartetFull && messageKind === "transient") {
      clearStatusMessage();
    }
  }, [isQuartetFull, messageKind]);

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        window.clearTimeout(messageTimeoutRef.current);
      }

      if (sungCelebrationTimeoutRef.current) {
        window.clearTimeout(sungCelebrationTimeoutRef.current);
      }
    };
  }, []);

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
    trackEvent("matches_generated", {
      session_id: sessionId,
      participant_count: participants.length,
      match_count: matches.length,
      ready_match_count: readyMatchCount,
      possible_match_count: possibleMatchCount,
      one_part_missing_count: onePartMissingCount,
    });
    if (participants.length >= MAX_QUARTET_PARTICIPANTS) {
      trackEvent("quartet_full", {
        session_id: sessionId,
        participant_count: participants.length,
      });
    }
    if (participants.length >= MAX_QUARTET_PARTICIPANTS && matches.length === 0) {
      trackEvent("zero_matches_found", {
        session_id: sessionId,
        participant_count: participants.length,
      });
    }
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
    const showActions = canManageParticipants;

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
              {isCurrentParticipant && (
                <span className="ml-2 rounded-full bg-cyan-300/15 px-2 py-0.5 text-xs font-semibold text-cyan-100">
                  You
                </span>
              )}
            </p>
            <p className="text-sm text-slate-300">
              {participant.repertoire.length} songs loaded
            </p>
          </div>

          {showActions && (
            <div className="flex flex-wrap gap-2">
              {isCurrentParticipant && (
                <>
                  <a
                    href="/repertoire"
                    className="w-fit rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10"
                  >
                    Edit My Songs
                  </a>
                  <a
                    href="/settings"
                    className="w-fit rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10"
                  >
                    Change name
                  </a>
                  <button
                    type="button"
                    onClick={requestLeaveQuartet}
                    disabled={leaving || !sessionId}
                    className="w-fit rounded-lg bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/20 disabled:opacity-40"
                  >
                    {leaving ? "Leaving..." : "Leave quartet"}
                  </button>
                </>
              )}
              {!isCurrentParticipant && (
                <button
                  type="button"
                  onClick={() => removeQuartetParticipant(participant)}
                  disabled={leaving || !sessionId || Boolean(removingParticipantId)}
                  className="w-fit rounded-lg bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/20 disabled:opacity-40"
                >
                  {removingParticipantId === participant.id
                    ? "Removing..."
                    : "Remove"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderConversationStarter(starter: ConversationStarter) {
    const coveredParts = Object.entries(starter.coveredParts) as Array<
      [Part, SingerEntry[]]
    >;
    const arrangerSummary = [
      ...starter.arrangerNames,
      starter.hasMissingArrangerInfo ? noArrangerEnteredLabel : null,
    ]
      .filter((name): name is string => Boolean(name))
      .join(", ");

    return (
      <article
        key={`${starter.voicing}-${starter.songTitle}`}
        className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="font-semibold text-white">{starter.songTitle}</h4>
            <p className="mt-1 text-sm text-slate-300">
              {voicingDisplayLabel(starter.voicing)}
              {arrangerSummary ? ` · Arr. ${arrangerSummary}` : ""}
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-950/70 px-2 py-1 text-xs font-semibold text-cyan-100">
            {starter.singerCount} singers
          </span>
        </div>

        {starter.warnings.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-300/10 p-2 text-xs text-amber-100">
            {starter.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {starter.arrangerVariantNote && (
          <p className="mt-3 text-xs text-slate-300">
            {starter.arrangerVariantNote}
          </p>
        )}

        <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">
              Covered
            </p>
            <div className="mt-1 space-y-1">
              {coveredParts.map(([part, singers]) => (
                <p key={part}>
                  <span className="font-semibold text-white">
                    {partAbbreviation(starter.voicing, part)}:
                  </span>{" "}
                  {singers.map((singer) => singer.displayName).join(", ")}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">
              Missing
            </p>
            <p className="mt-1">
              {starter.missingParts.length > 0
                ? starter.missingParts
                    .map((part) => functionalPartName(starter.voicing, part))
                    .join(", ")
                : "Distinct singers do not cover every required part yet."}
            </p>
          </div>
        </div>
      </article>
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
        <QuartetActionConfirmation
          open={showLeaveConfirmation}
          busy={leaving}
          title="Leave quartet?"
          description="You'll be removed from this quartet. You can rejoin later with the code if there is still room."
          confirmLabel="Leave quartet"
          busyLabel="Leaving..."
          onCancel={() => setShowLeaveConfirmation(false)}
          onConfirm={confirmLeaveQuartet}
        />
        <QuartetActionConfirmation
          open={Boolean(participantToRemove)}
          busy={Boolean(removingParticipantId)}
          title="Remove singer?"
          description={`${
            participantToRemove
              ? getParticipantDisplayName(
                  participantToRemove,
                  profileDisplayNamesByUserId
                )
              : "This singer"
          } will be removed from this quartet. They can rejoin later with the code if there is still room.`}
          confirmLabel="Remove from quartet"
          busyLabel="Removing..."
          onCancel={() => setParticipantToRemove(null)}
          onConfirm={confirmRemoveQuartetParticipant}
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-4xl font-bold">Quartet {code}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {expirationLabel && (
              <p className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-semibold text-slate-300">
                {expirationLabel}
              </p>
            )}
            {showManageButton && (
              <button
                type="button"
                aria-expanded={isManageOpen}
                aria-controls="quartet-manage-panel"
                onClick={() => setIsManageOpen((open) => !open)}
                className="rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10"
              >
                Manage
              </button>
            )}
          </div>
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
          <div
            className={`mt-4 flex items-start justify-between gap-3 rounded-xl p-4 text-sm ${
              messageKind === "error"
                ? "border border-rose-300/20 bg-rose-400/10 text-rose-100"
                : messageKind === "success"
                  ? "border border-cyan-300/30 bg-cyan-300/10 text-cyan-50"
                : "bg-white/10 text-slate-200"
            }`}
            role={messageKind === "error" ? "alert" : "status"}
          >
            <p>{message}</p>
            <button
              type="button"
              onClick={clearStatusMessage}
              className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
            >
              Dismiss
            </button>
          </div>
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

        {!loadError &&
          !quartetExpired &&
          !pendingActiveQuartet &&
          !shouldShowQuartetResults &&
          isQuartetFull && (
            <div className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-6">
              <p className="font-semibold text-rose-100">
                {quartetFullMessage}
              </p>
              <p className="mt-2 text-sm text-rose-100">
                A quartet can have up to four singers.
              </p>
              <a
                href="/join"
                className="mt-4 inline-block rounded-xl bg-rose-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white"
              >
                Enter a different code
              </a>
            </div>
          )}

        {!loadError &&
          !quartetExpired &&
          !pendingActiveQuartet &&
          shouldShowQuartetResults && (
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

            {isManageOpen && showManageButton && (
              <section
                id="quartet-manage-panel"
                className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4"
              >
                <h2 className="text-xl font-semibold">People in this quartet</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Update your songs or display name here, or manage who is in
                  this quartet.
                </p>
                <div className="mt-4 space-y-3">
                  {orderedParticipants.map((participant) =>
                    renderParticipantRow(participant)
                  )}
                </div>
              </section>
            )}

            {!isQuartetFull && (
              <>
                {leftQuartet && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-6">
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
                  </div>
                )}

                <div className="mt-8">
                  <h2 className="text-2xl font-semibold">Participants</h2>

                  <div className="mt-4 space-y-3">
                    {participants.length === 0 && (
                      <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                        No singers have joined yet.
                      </p>
                    )}

                    {orderedParticipants.map((participant) =>
                      renderParticipantRow(participant)
                    )}
                  </div>
                </div>
              </>
            )}

            <div className={isQuartetFull ? "mt-4" : "mt-10"}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Matches</h2>
                </div>
                {matches.length > 0 && (
                  <p className="text-sm font-semibold text-cyan-300">
                    {matches.length} total
                  </p>
                )}
              </div>

              <div className="mt-4 space-y-5">
                {matches.length === 0 && isQuartetFull && (
                  <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-xl font-semibold text-white">
                      No quartet-ready matches yet
                    </h3>
                    <p className="mt-2 text-slate-300">
                      Across the songs entered by this quartet, we did not find
                      a song where all required parts are covered by different
                      singers.
                    </p>
                    <div className="mt-4 rounded-xl bg-slate-950/50 p-4">
                      <p className="font-semibold text-slate-100">Try this:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                        <li>Talk through songs the group may have in common.</li>
                        <li>Add a few more songs to My Songs.</li>
                        <li>
                          Check title, voicing, and arranger if you think a song
                          should match.
                        </li>
                      </ul>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <a
                        href="/repertoire"
                        className="rounded-xl bg-cyan-300 px-5 py-3 text-center font-semibold text-slate-950 hover:bg-cyan-200"
                      >
                        Review My Songs
                      </a>
                    </div>

                    {conversationStarters.length === 0 && (
                      <p className="mt-4 text-sm text-slate-400">
                        The prompts below can still help the group compare
                        songs and parts.
                      </p>
                    )}
                  </section>
                )}

                {matches.length === 0 && !isQuartetFull && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                    No matches yet. Add more singers or saved songs.
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
                                isSungCelebrating={celebratingSungKey === id}
                                onToggle={() => toggleExpandedMatch(id)}
                                onMarkAsSung={() => markMatchAsSung(match)}
                              />
                            );
                          })}
                        </div>
                      </section>
                    )
                )}

                {showConversationStartersSection && (
                  <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-5">
                    <h3 className="text-lg font-semibold text-cyan-100">
                      Conversation starters
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {conversationStartersIntro(readyMatchCount)}
                    </p>
                    {conversationStarters.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {conversationStarters.map(renderConversationStarter)}
                      </div>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                        <li>Ask if anyone knows another part on a shared song.</li>
                        <li>Compare title, voicing, and arranger for near misses.</li>
                        <li>Add one or two likely shared songs to My Songs.</li>
                      </ul>
                    )}
                  </section>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
