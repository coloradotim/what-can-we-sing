"use client";

import { AppNav } from "@/components/AppNav";
import {
  getCurrentUser,
  getMyProfile,
  upsertMyProfile,
} from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [showRepertoireNextStep, setShowRepertoireNextStep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        setIsLoggedIn(true);
        setEmail(user.email ?? "");

        const profile = await getMyProfile();

        if (profile) {
          setDisplayName(profile.display_name ?? "");
        } else {
          setMessage(
            "Add a display name before joining a quartet so other singers know who you are."
          );
        }
      } catch (err) {
        console.error(err);
        setMessage("Could not load settings. Refresh the page and try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function saveSettings() {
    if (isSaving) return;

    if (!displayName.trim()) {
      setDisplayNameError("Display name is required.");
      setMessage("");
      return;
    }

    try {
      setIsSaving(true);
      setDisplayNameError("");
      await upsertMyProfile(displayName.trim());

      let repertoireCount: number | null = null;
      try {
        const repertoire = await getMyRepertoire();
        repertoireCount = repertoire.length;
      } catch (err) {
        console.error(err);
      }

      if (repertoireCount === 0) {
        setMessage("Settings saved. Next, add a few songs you know.");
        setShowRepertoireNextStep(true);
        return;
      }

      setMessage(
        repertoireCount === null
          ? "Settings saved. Could not check your songs yet."
          : "Settings saved."
      );
      setShowRepertoireNextStep(false);
    } catch (err) {
      console.error(err);
      setMessage("Could not save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading settings...
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Redirecting to login...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <AppNav />

        <h1 className="mt-4 text-4xl font-bold">Settings</h1>
        <p className="mt-2 text-slate-300">{email}</p>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (displayNameError) setDisplayNameError("");
              }}
              aria-invalid={Boolean(displayNameError)}
              aria-describedby={
                displayNameError ? "display-name-error" : undefined
              }
              className={`mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none focus:ring-2 ${
                displayNameError
                  ? "ring-2 ring-rose-300"
                  : "ring-cyan-300"
              }`}
            />
            {displayNameError && (
              <p id="display-name-error" className="mt-2 text-sm text-rose-200">
                {displayNameError}
              </p>
            )}
          </label>

          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Save settings"}
          </button>

          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}

          {showRepertoireNextStep && (
            <a
              href="/repertoire"
              className="mt-4 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/20"
            >
              Add songs
            </a>
          )}
        </section>

        <p className="mt-5 text-sm text-slate-400">
          See what data is stored and why on the{" "}
          <a
            href="/privacy"
            className="font-semibold text-cyan-300 hover:text-cyan-200"
          >
            privacy page
          </a>
          .
        </p>
      </div>
    </main>
  );
}
