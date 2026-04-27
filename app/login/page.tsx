"use client";

import { getMagicLinkRedirectUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendMagicLink() {
    if (!email.trim()) {
      setMessage("Enter your email address and we’ll send a login link.");
      return;
    }

    setIsSending(true);
    setMessage("");

    const emailRedirectTo = getMagicLinkRedirectUrl({
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      origin: window.location.origin,
      search: window.location.search,
    });

    if (!emailRedirectTo) {
      setMessage("Login is not configured for this site yet.");
      setIsSending(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        setMessage(`${error.message} Check the email address and try again.`);
        return;
      }

      setMessage(
        "Check your email for a What Can We Sing login link. Open it in this browser to continue."
      );
    } catch (err) {
      console.error(err);
      setMessage("Network unavailable. Try again when you have a connection.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-4xl font-bold">Log in</h1>
        <p className="mt-3 text-slate-300">
          Enter your email and we’ll send you a magic link. There is no password
          to remember.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Email address
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
            />
          </label>

          <button
            onClick={sendMagicLink}
            disabled={isSending}
            className="mt-4 w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            {isSending ? "Sending..." : "Send magic link"}
          </button>

          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
        </div>

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
