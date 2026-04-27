"use client";

import { AppNav } from "@/components/AppNav";
import { useState } from "react";

export default function Home() {
  const [joinCode, setJoinCode] = useState("");

  function joinQuartet() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    window.location.href = `/join/${encodeURIComponent(code)}`;
  }

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
        <p className="mt-4 text-slate-300">
          Start a quartet, join with a code, or update the songs you know.
        </p>

        <div className="mt-10 space-y-3">
          <a
            href="/session"
            className="block rounded-xl bg-cyan-300 px-5 py-4 text-center font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Start a quartet
          </a>

          <div
            id="join-quartet"
            className="rounded-xl border border-white/10 bg-white/10 p-4"
          >
            <label className="block">
              <span className="text-sm font-medium text-slate-300">
                Join a quartet
              </span>
              <div className="mt-2 flex gap-2">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") joinQuartet();
                  }}
                  placeholder="Code"
                  className="min-w-0 flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white uppercase outline-none ring-cyan-300 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={joinQuartet}
                  disabled={!joinCode.trim()}
                  className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </label>
          </div>

          <a
            href="/repertoire"
            className="block rounded-xl bg-white/10 px-5 py-4 text-center font-semibold text-white hover:bg-white/20"
          >
            My repertoire
          </a>
        </div>
      </div>
    </main>
  );
}
