"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import {
  clearActiveQuartet,
  getActiveQuartet,
  type ActiveQuartet,
} from "@/lib/activeQuartet";
import { getCurrentUser } from "@/lib/profileStore";
import { trackEvent } from "@/lib/analytics";
import { createSession, removeParticipant } from "@/lib/sessionStore";

function makeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function SessionPage() {
  const [loading, setLoading] = useState(true);
  const [activeQuartet, setActiveQuartet] = useState<ActiveQuartet | null>(null);
  const [leavingCurrent, setLeavingCurrent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const currentQuartet = getActiveQuartet();

    if (currentQuartet) {
      setActiveQuartet(currentQuartet);
      setLoading(false);
      return;
    }

    createNewQuartet();
  }, []);

  async function createNewQuartet() {
    setLoading(true);
    setErrorMessage("");

    async function init() {
      const code = makeJoinCode();

      try {
        const session = await createSession(code);
        trackEvent("quartet_started", {
          session_id: session.id,
          participant_count: 0,
        });
        window.location.href = `/join/${code}`;
      } catch (err) {
        console.error("Failed to create session", err);
        setErrorMessage(
          "Could not create a quartet code. Check your connection and try again."
        );
      } finally {
        setLoading(false);
      }
    }

    init();
  }

  async function leaveCurrentAndContinue() {
    if (!activeQuartet) return;

    setLeavingCurrent(true);
    setErrorMessage("");

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error("You must be logged in to leave a quartet.");
      }

      await removeParticipant(activeQuartet.sessionId, user.id);
      trackEvent("quartet_left", {
        session_id: activeQuartet.sessionId,
      });
      clearActiveQuartet();
      setActiveQuartet(null);
      await createNewQuartet();
    } catch (err) {
      console.error("Failed to leave current quartet", err);
      setErrorMessage(
        "Could not leave your current quartet. Check your connection and try again."
      );
      setLeavingCurrent(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Creating quartet...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <AppNav />

        <h1 className="mt-4 text-4xl font-bold">Start a quartet</h1>

        {activeQuartet && (
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
              Return to quartet {activeQuartet.code}, or leave it before
              starting a new quartet.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-6">
            <p className="font-semibold text-rose-100">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-rose-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white"
            >
              Try again
            </button>
          </div>
        )}

        {!activeQuartet && !errorMessage && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6">
            <p className="text-slate-300">Creating your quartet...</p>
          </div>
        )}
      </div>
    </main>
  );
}
