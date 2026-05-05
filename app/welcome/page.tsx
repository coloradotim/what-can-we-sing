"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, getMyProfile, markWelcomeSeen } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import { hasQuartetWorkflowHistory } from "@/lib/activeQuartet";
import { isSafeAppRedirectPath } from "@/lib/authRedirect";

function getRedirectPath() {
  if (typeof window === "undefined") return "/songs";

  const redirect = new URLSearchParams(window.location.search).get("redirect");
  return isSafeAppRedirectPath(redirect) ? redirect : "/songs";
}

export default function WelcomePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hasDisplayName, setHasDisplayName] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const [profile, repertoire] = await Promise.all([
          getMyProfile(),
          getMyRepertoire().catch(() => []),
        ]);
        const displayNameIsSet = Boolean(profile?.display_name?.trim());
        setHasDisplayName(displayNameIsSet);

        if (
          profile?.has_seen_welcome ||
          repertoire.length > 0 ||
          hasQuartetWorkflowHistory()
        ) {
          window.location.href = displayNameIsSet ? getRedirectPath() : "/settings";
          return;
        }
      } catch (err) {
        console.error(err);
        setMessage("Could not load the quick start. Refresh and try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function getStarted() {
    if (saving) return;

    try {
      setSaving(true);
      setMessage("");
      await markWelcomeSeen();
      window.location.href = hasDisplayName ? "/songs" : "/settings";
    } catch (err) {
      console.error(err);
      setMessage("Could not save your quick-start progress. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        Loading quick start...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center">
        <section className="w-full rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-6 shadow-2xl shadow-cyan-950/30 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-normal text-cyan-200">
            Quick start
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Welcome to What Can We Sing
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-200">
            What Can We Sing helps a pickup quartet figure out what everyone can
            sing together right now.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="font-semibold text-white">To get useful matches:</p>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
              <li>1. Set your display name.</li>
              <li>
                2. Add a few songs you know, not every song. You can type songs
                in, copy songs from another singer, or add Harmony Brigade songs
                if that applies to you.
              </li>
              <li>3. Start a quartet or join one with a code, QR code, or link.</li>
              <li>4. Use the match list to pick something and sing.</li>
            </ol>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-300">
            You can always add more songs later.
          </p>

          <button
            type="button"
            onClick={getStarted}
            disabled={saving}
            className="mt-6 w-full rounded-xl bg-cyan-300 px-5 py-4 text-base font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-40 sm:w-auto"
          >
            {saving ? "Starting..." : "Get started"}
          </button>

          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
        </section>
      </div>
    </main>
  );
}
