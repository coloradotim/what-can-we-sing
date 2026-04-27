"use client";

import { AppNav } from "@/components/AppNav";
import { useState } from "react";

export default function JoinPage() {
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");

  function joinQuartet() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setMessage("Enter the quartet code another singer shared with you.");
      return;
    }

    window.location.href = `/join/${encodeURIComponent(code)}`;
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
      </div>
    </main>
  );
}
