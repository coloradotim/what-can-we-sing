"use client";

import { SignOutButton } from "@/components/SignOutButton";
import {
  getCurrentUser,
  getMyProfile,
  upsertMyProfile,
} from "@/lib/profileStore";
import { useEffect, useState } from "react";

const defaultParts = [
  "",
  "Tenor",
  "Lead",
  "Baritone",
  "Bass",
  "Soprano",
  "Alto",
  "Soprano 1",
  "Soprano 2",
  "Alto 1",
  "Alto 2",
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultPart, setDefaultPart] = useState("");
  const [message, setMessage] = useState("");

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
          setDefaultPart(profile.default_part ?? "");
        }
      } catch (err) {
        console.error(err);
        setMessage("Could not load settings.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function saveSettings() {
    if (!displayName.trim()) return;

    try {
      await upsertMyProfile(displayName.trim(), defaultPart);
      setMessage("Settings saved.");
    } catch (err) {
      console.error(err);
      setMessage("Could not save settings.");
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
        <div className="flex flex-wrap items-center gap-4">
          <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
            ← Back home
          </a>
          {isLoggedIn && <SignOutButton />}
        </div>

        <h1 className="mt-4 text-4xl font-bold">Settings</h1>
        <p className="mt-2 text-slate-300">{email}</p>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tim"
              className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-300">
              Default part optional
            </span>
            <select
              value={defaultPart}
              onChange={(e) => setDefaultPart(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
            >
              {defaultParts.map((part) => (
                <option key={part} value={part}>
                  {part || "No default"}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={saveSettings}
            disabled={!displayName.trim()}
            className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            Save settings
          </button>

          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
        </section>
      </div>
    </main>
  );
}
