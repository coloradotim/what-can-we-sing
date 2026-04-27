"use client";

import { AppNav } from "@/components/AppNav";
import {
  clearActiveQuartet,
  getActiveQuartet,
  type ActiveQuartet,
} from "@/lib/activeQuartet";
import { getCurrentUser } from "@/lib/profileStore";
import { removeParticipant } from "@/lib/sessionStore";
import { useState } from "react";

export default function JoinPage() {
  const [joinCode, setJoinCode] = useState("");
  const [pendingCode, setPendingCode] = useState("");
  const [activeQuartet, setActiveQuartet] = useState<ActiveQuartet | null>(null);
  const [leavingCurrent, setLeavingCurrent] = useState(false);
  const [message, setMessage] = useState("");

  function joinQuartet() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setMessage("Enter the quartet code another singer shared with you.");
      return;
    }

    const currentQuartet = getActiveQuartet();
    if (currentQuartet && currentQuartet.code !== code) {
      setPendingCode(code);
      setActiveQuartet(currentQuartet);
      setMessage("");
      return;
    }

    window.location.href = `/join/${encodeURIComponent(code)}`;
  }

  async function leaveCurrentAndContinue() {
    if (!activeQuartet || !pendingCode) return;

    setLeavingCurrent(true);
    setMessage("");

    try {
      const user = await getCurrentUser();
      if (user) {
        await removeParticipant(activeQuartet.sessionId, user.id);
      }
      clearActiveQuartet();
      window.location.href = `/join/${encodeURIComponent(pendingCode)}`;
    } catch (err) {
      console.error("Failed to leave current quartet", err);
      setMessage(
        "Could not leave your current quartet. Check your connection and try again."
      );
      setLeavingCurrent(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-md">
        <AppNav />

        <h1 className="mt-8 text-4xl font-bold tracking-tight">
          Join a quartet
        </h1>
        <p className="mt-3 text-slate-300">
          Enter the code another singer shared with you.
        </p>

        <section className="mt-8 rounded-xl border border-white/10 bg-white/10 p-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Quartet code
            </span>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") joinQuartet();
              }}
              autoCapitalize="characters"
              className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-white uppercase outline-none ring-cyan-300 focus:ring-2"
            />
          </label>

          <button
            type="button"
            onClick={joinQuartet}
            className="mt-4 w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            Join quartet
          </button>

          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
        </section>

        {activeQuartet && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-quartet-title"
            className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5"
          >
            <h2 id="active-quartet-title" className="text-xl font-semibold">
              You are already in a quartet
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Return to quartet {activeQuartet.code}, or leave it before
              joining quartet {pendingCode}.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <a
                href={`/join/${activeQuartet.code}`}
                className="rounded-xl bg-cyan-300 px-5 py-3 text-center font-semibold text-slate-950 hover:bg-cyan-200"
              >
                Return to current quartet
              </a>
              <button
                type="button"
                onClick={leaveCurrentAndContinue}
                disabled={leavingCurrent}
                className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                {leavingCurrent
                  ? "Leaving..."
                  : "Leave current quartet and continue"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
