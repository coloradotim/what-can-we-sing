"use client";

import { useEffect, useState } from "react";
import { findMatches, SingerEntry } from "@/lib/matching";

type RepertoireItem = {
  id: string;
  songTitle: string;
  voicing: "TTBB" | "SATB" | "SSAA";
  arrangerName?: string;
  partsKnown: any[];
  confidence: any;
};

export default function Home() {
  const [entries, setEntries] = useState<SingerEntry[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("quartet-match-repertoire");
      if (!saved) return;

      const repertoire: RepertoireItem[] = JSON.parse(saved);

      const converted: SingerEntry[] = repertoire.map((item) => ({
        userId: "me",
        displayName: "You",
        songTitle: item.songTitle,
        voicing: item.voicing,
        arrangerName: item.arrangerName ?? null,
        partsKnown: item.partsKnown,
        confidence: item.confidence,
      }));

      setEntries(converted);
    } catch {
      console.warn("Failed to load repertoire");
    }
  }, []);

  const matches = findMatches(entries);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex gap-4">
          <a href="/repertoire" className="text-sm text-cyan-300 hover:text-cyan-200">
            → Manage my repertoire
          </a>
          <a href="/session" className="text-sm text-cyan-300 hover:text-cyan-200">
            → Start session
          </a>
          <a href="/settings" className="text-sm text-cyan-300 hover:text-cyan-200">
            → Settings
          </a>
          <a href="/login" className="text-sm text-cyan-300 hover:text-cyan-200">
            → Log in
          </a>
        </div>

        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-cyan-300">
          Quartet Match
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Your songs (solo view for now)
        </h1>

        {entries.length === 0 && (
          <p className="mt-6 text-slate-300">
            You haven’t added any songs yet. Go to “Manage my repertoire.”
          </p>
        )}

        <div className="mt-8 space-y-4">
          {matches.map((match) => (
            <section
              key={`${match.songTitle}-${match.voicing}`}
              className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {match.songTitle} — {match.voicing}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {match.category === "ready" && "You can cover all parts"}
                    {match.category === "possible" && "Possible match"}
                    {match.category === "one_part_missing" &&
                      `Missing: ${match.missingParts.join(", ")}`}
                  </p>
                </div>

                <span className="rounded-full bg-cyan-300 px-3 py-1 text-sm font-semibold text-slate-950">
                  {match.category}
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
              </div>

              {match.warnings.length > 0 && (
                <div className="mt-4 rounded-xl bg-amber-300/10 p-3 text-sm text-amber-200">
                  {match.warnings.map((warning) => (
                    <p key={warning}>⚠ {warning}</p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}