"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { findMatches, SingerEntry } from "@/lib/matching";
import {
  addParticipant,
  getParticipants,
  getSessionByCode,
} from "@/lib/sessionStore";
import { getCurrentUser, getMyProfile } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";

export default function JoinSessionPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [participants, setParticipants] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function refreshParticipants(id: string) {
    const data = await getParticipants(id);
    setParticipants(data);
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

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

        setDisplayName(profile.display_name);

        const session = await getSessionByCode(code);
        setSessionId(session.id);

        await refreshParticipants(session.id);

        interval = setInterval(() => {
          refreshParticipants(session.id);
        }, 2000);
      } catch (err) {
        console.error(err);
        setMessage("Could not load this session.");
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [code]);

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

  async function joinSession() {
    if (!sessionId || !displayName) return;

    try {
      const entries = await getMyEntries(displayName);
      await addParticipant(sessionId, displayName, entries);
      await refreshParticipants(sessionId);
      setMessage(`Joined as ${displayName} with ${entries.length} songs.`);
    } catch (err) {
      console.error(err);
      setMessage("Could not join session.");
    }
  }

  const allEntries: SingerEntry[] = participants.flatMap((p) => p.repertoire);
  const matches = findMatches(allEntries);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading session...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <a href="/session" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Start another session
        </a>

        <h1 className="mt-4 text-4xl font-bold">Session {code}</h1>

        {message && (
          <p className="mt-4 rounded-xl bg-white/10 p-4 text-slate-200">
            {message}
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-6">
          <p className="text-slate-300">You are joining as:</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{displayName}</p>

          <button
            onClick={joinSession}
            disabled={!sessionId || !displayName}
            className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            Join with my repertoire
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
          <h2 className="text-2xl font-semibold">Matches</h2>

          <div className="mt-4 space-y-4">
            {matches.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                No matches yet. Add more singers or repertoire.
              </p>
            )}

            {matches.map((match) => (
              <div
                key={match.songTitle + match.voicing}
                className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {match.songTitle} — {match.voicing}
                    </h3>

                    <p className="mt-1 text-sm text-slate-300">
                      {match.category === "ready" && "Ready to sing"}
                      {match.category === "possible" &&
                        "Possible match — confirm arrangement"}
                      {match.category === "one_part_missing" &&
                        `One part missing: ${match.missingParts.join(", ")}`}
                    </p>
                  </div>

                  <span className="rounded-full bg-cyan-300 px-3 py-1 text-sm font-semibold text-slate-950">
                    {match.category.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Object.entries(match.assignments).map(([part, singers]) => (
                    <div key={part} className="rounded-xl bg-slate-900/70 p-3">
                      <p className="font-semibold">{part}</p>
                      <p className="text-sm text-slate-300">
                        {singers.map((s) => s.displayName).join(", ")}
                      </p>
                    </div>
                  ))}

                  {match.missingParts.map((part) => (
                    <div
                      key={part}
                      className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-3"
                    >
                      <p className="font-semibold text-rose-200">{part}</p>
                      <p className="text-sm text-rose-200">Missing</p>
                    </div>
                  ))}
                </div>

                {match.warnings.length > 0 && (
                  <div className="mt-4 rounded-xl bg-amber-300/10 p-3 text-sm text-amber-200">
                    {match.warnings.map((warning) => (
                      <p key={warning}>⚠ {warning}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}