"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { MatchCard } from "@/components/MatchCard";
import { findMatches, SingerEntry } from "@/lib/matching";
import {
  type DbParticipant,
  getParticipants,
  getSessionByCode,
  subscribeToSessionParticipants,
  upsertParticipant,
} from "@/lib/sessionStore";
import { getCurrentUser, getMyProfile } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";

const matchSections = [
  {
    category: "ready",
    title: "Ready",
    description: "All required parts are covered.",
  },
  {
    category: "possible",
    title: "Possible",
    description: "Check arranger details before singing.",
  },
  {
    category: "one_part_missing",
    title: "One part missing",
    description: "Close matches that need one more singer or part.",
  },
] as const;

export default function JoinSessionPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const hasAutoJoined = useRef(false);

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [participants, setParticipants] = useState<DbParticipant[]>([]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  async function refreshParticipants(id: string) {
    const data = await getParticipants(id);
    setParticipants(data);
    return data;
  }

  async function getMyEntries(name: string): Promise<SingerEntry[]> {
    const repertoire = await getMyRepertoire();

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
    userId = currentUserId
  ) {
    if (!id || !name || !userId) {
      setMessage("Could not refresh yet. Wait for the quartet to finish loading.");
      return;
    }

    try {
      const existingParticipants = await refreshParticipants(id);

      const existingParticipant = existingParticipants.find(
        (participant) => participant.user_id === userId
      );

      const entries = await getMyEntries(name);

      await upsertParticipant(id, userId, name, entries);
      await refreshParticipants(id);

      if (existingParticipant) {
        setMessage(`Updated ${name}'s repertoire with ${entries.length} songs.`);
        return;
      }

      setMessage(`Joined as ${name} with ${entries.length} songs.`);
    } catch (err) {
      console.error(err);
      setMessage("Could not join quartet. Check your connection and try again.");
    }
  }

  useEffect(() => {
    let unsubscribe: undefined | (() => void);

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

        setCurrentUserId(user.id);
        setDisplayName(profile.display_name);
        setSessionId(session.id);

        const currentParticipants = await refreshParticipants(session.id);

        unsubscribe = subscribeToSessionParticipants(session.id, () => {
          refreshParticipants(session.id);
        });

        const alreadyJoined = currentParticipants.some(
          (participant) => participant.user_id === user.id
        );

        if (!alreadyJoined && !hasAutoJoined.current) {
          hasAutoJoined.current = true;
          await joinSession(session.id, profile.display_name, user.id);
        } else {
          setMessage(`You are already in this quartet as ${profile.display_name}.`);
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
      if (unsubscribe) unsubscribe();
    };
  }, [code]);

  const allEntries: SingerEntry[] = participants.flatMap((p) => p.repertoire);
  const matches = findMatches(allEntries);
  const groupedMatches = matchSections.map((section) => ({
    ...section,
    matches: matches.filter((match) => match.category === section.category),
  }));

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

        <h1 className="mt-4 text-4xl font-bold">Quartet {code}</h1>

        {loadError && (
          <div className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-6">
            <p className="font-semibold text-rose-100">{loadError}</p>
            <a
              href="/join"
              className="mt-4 inline-block rounded-xl bg-rose-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white"
            >
              Enter a different code
            </a>
          </div>
        )}

        {!loadError && message && (
          <p className="mt-4 rounded-xl bg-white/10 p-4 text-slate-200">
            {message}
          </p>
        )}

        {!loadError && (
          <>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-6">
              <p className="text-slate-300">You are in this quartet as:</p>
              <p className="mt-1 text-2xl font-bold text-cyan-300">
                {displayName}
              </p>

              <button
                onClick={() => joinSession()}
                disabled={!sessionId || !displayName || !currentUserId}
                className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
              >
                Rejoin / refresh my repertoire
              </button>

              <a
                href="/settings"
                className="ml-4 inline-block text-sm text-cyan-300 hover:text-cyan-200"
              >
                Change settings
              </a>

              <a
                href="/repertoire"
                className="ml-4 inline-block text-sm text-cyan-300 hover:text-cyan-200"
              >
                Edit repertoire
              </a>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-semibold">Participants</h2>

              <div className="mt-4 space-y-3">
                {participants.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                    No singers have joined yet.
                  </p>
                )}

                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-white/10 bg-white/10 p-4"
                  >
                    <p className="font-semibold">{p.display_name}</p>
                    <p className="text-sm text-slate-300">
                      {p.repertoire.length} songs loaded
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Matches</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Results stay ranked within each group.
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
                        className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"
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

                        <div className="mt-3 space-y-3">
                          {section.matches.map((match) => (
                            <MatchCard
                              key={match.songTitle + match.voicing}
                              match={match}
                            />
                          ))}
                        </div>
                      </section>
                    )
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
