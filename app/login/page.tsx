"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function sendMagicLink() {
    if (!email.trim()) return;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/settings`,
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Check your email for a login link.");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-4xl font-bold">Log in</h1>
        <p className="mt-3 text-slate-300">
          Enter your email and we’ll send you a magic link.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
          />

          <button
            onClick={sendMagicLink}
            disabled={!email.trim()}
            className="mt-4 w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            Send magic link
          </button>

          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
        </div>
      </div>
    </main>
  );
}