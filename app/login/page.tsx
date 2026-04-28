"use client";

import { getPostLoginRedirectPath } from "@/lib/authRedirect";
import { loginIntro } from "@/lib/loginContent";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [hasSentCode, setHasSentCode] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function sendLoginCode() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setMessage("Enter your email address and we’ll send a login code.");
      return;
    }

    setIsSending(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setMessage(`${error.message} Check the email address and try again.`);
        return;
      }

      setHasSentCode(true);
      setCode("");
      setMessage("Enter the code sent to your email.");
    } catch (err) {
      console.error(err);
      setMessage("Network unavailable. Try again when you have a connection.");
    } finally {
      setIsSending(false);
    }
  }

  async function verifyLoginCode() {
    const normalizedEmail = email.trim();
    const normalizedCode = code.replace(/\s+/g, "");

    if (!normalizedEmail) {
      setMessage("Enter your email address and request a new code.");
      setHasSentCode(false);
      return;
    }

    if (!normalizedCode) {
      setMessage("Enter the code sent to your email.");
      return;
    }

    setIsVerifying(true);
    setMessage("");

    try {
      const emailResult = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedCode,
        type: "email",
      });
      const signupResult = emailResult.error
        ? await supabase.auth.verifyOtp({
            email: normalizedEmail,
            token: normalizedCode,
            type: "signup",
          })
        : emailResult;

      if (signupResult.error) {
        setMessage(
          "That code did not work. Check the code, request a new one if it expired, and try again."
        );
        return;
      }

      window.location.href = getPostLoginRedirectPath(window.location.search);
    } catch (err) {
      console.error(err);
      setMessage("Network unavailable. Try again when you have a connection.");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-md">
        <section className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-5">
          <p className="text-sm font-semibold uppercase text-cyan-300">
            {loginIntro.title}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            What can we sing together right now?
          </h1>
          <p className="mt-3 text-slate-200">{loginIntro.description}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {loginIntro.details}
          </p>
          <p className="mt-3 text-sm font-semibold text-cyan-100">
            {loginIntro.signInReason}
          </p>
        </section>

        <h2 className="mt-8 text-3xl font-bold">Log in</h2>
        <p className="mt-3 text-slate-300">
          Enter your email and we’ll send you a one-time code. There is no
          password to remember.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Email address
            </span>
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setHasSentCode(false);
                setCode("");
                setMessage("");
              }}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
            />
          </label>

          <button
            onClick={sendLoginCode}
            disabled={isSending || isVerifying}
            className="mt-4 w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            {isSending
              ? "Sending..."
              : hasSentCode
              ? "Resend code"
              : "Send code"}
          </button>

          {hasSentCode && (
            <>
              <label className="mt-5 block">
                <span className="text-sm font-medium text-slate-300">
                  One-time code
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
                />
              </label>

              <button
                onClick={verifyLoginCode}
                disabled={isSending || isVerifying}
                className="mt-4 w-full rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-40"
              >
                {isVerifying ? "Checking..." : "Log in with code"}
              </button>
            </>
          )}

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
