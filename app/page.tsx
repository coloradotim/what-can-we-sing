"use client";

import { AppNav } from "@/components/AppNav";
import { getCurrentUser, getMyProfile } from "@/lib/profileStore";
import { getMyRepertoire } from "@/lib/repertoireStore";
import { useEffect, useState } from "react";

const actions = [
  {
    href: "/session",
    title: "Start a quartet",
    description: "Create a code for others to join.",
  },
  {
    href: "/join",
    title: "Join a quartet",
    description: "Enter a code from another singer.",
  },
  {
    href: "/repertoire",
    title: "My repertoire",
    description: "Add or update songs you know.",
  },
];

type SetupState = "loading" | "missing_profile" | "missing_repertoire" | "ready";

const setupPrompts: Record<
  Exclude<SetupState, "loading" | "ready">,
  {
    message: string;
    href: string;
    action: string;
  }
> = {
  missing_profile: {
    message: "Add your display name so other singers know who you are.",
    href: "/settings",
    action: "Add display name",
  },
  missing_repertoire: {
    message: "Add a few songs before starting or joining a quartet.",
    href: "/repertoire",
    action: "Add songs",
  },
};

export default function Home() {
  const [setupState, setSetupState] = useState<SetupState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSetupState() {
      try {
        const user = await getCurrentUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const profile = await getMyProfile();
        if (!profile?.display_name) {
          setSetupState("missing_profile");
          return;
        }

        const repertoire = await getMyRepertoire();
        setSetupState(repertoire.length > 0 ? "ready" : "missing_repertoire");
      } catch (err) {
        console.error(err);
        setMessage("Could not check your setup. Refresh the page and try again.");
        setSetupState("ready");
      }
    }

    loadSetupState();
  }, []);

  const setupPrompt =
    setupState === "missing_profile" || setupState === "missing_repertoire"
      ? setupPrompts[setupState]
      : null;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <AppNav />

        <p className="mt-8 text-sm font-semibold uppercase text-cyan-300">
          What Can We Sing
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Find songs your quartet can sing now.
        </h1>

        {message && <p className="mt-4 text-sm text-rose-200">{message}</p>}

        {setupState === "loading" && (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/10 px-5 py-4 text-slate-300">
            Checking your setup...
          </div>
        )}

        {setupPrompt && (
          <div className="mt-10 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4">
            <p className="text-lg font-semibold text-white">
              {setupPrompt.message}
            </p>
            <a
              href={setupPrompt.href}
              className="mt-4 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
            >
              {setupPrompt.action}
            </a>
          </div>
        )}

        {setupState === "ready" && (
          <>
            <p className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-sm text-slate-300">
              Start a quartet, join with a code, or update your repertoire.
            </p>

            <div className="mt-4 space-y-3">
              {actions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="block rounded-xl border border-white/10 bg-white/10 px-5 py-4 hover:border-cyan-300/60 hover:bg-white/15"
                >
                  <span className="block text-lg font-semibold text-white">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-sm text-slate-300">
                    {action.description}
                  </span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
