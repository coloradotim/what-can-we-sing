"use client";

import { AppNav } from "@/components/AppNav";
import { trackEvent } from "@/lib/analytics";
import {
  feedbackTypes,
  maxFeedbackMessageLength,
  type FeedbackType,
} from "@/lib/feedback";
import { helpSections, quickStartSteps } from "@/lib/helpContent";
import { getCurrentUser } from "@/lib/profileStore";
import { useEffect, useState } from "react";

export default function HelpPage() {
  const [type, setType] = useState<FeedbackType>("Bug report");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">(
    "info"
  );
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    trackEvent("help_viewed");

    async function loadUserEmail() {
      try {
        const user = await getCurrentUser();
        setContactEmail(user?.email ?? "");
      } catch (err) {
        console.error(err);
      }
    }

    loadUserEmail();
  }, []);

  async function sendFeedback() {
    if (isSending) return;

    if (!message.trim()) {
      setStatusTone("error");
      setStatusMessage("Add a message before sending feedback.");
      return;
    }

    setIsSending(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          message,
          contactEmail,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatusTone("error");
        setStatusMessage(data.message ?? "Could not send feedback.");
        return;
      }

      trackEvent("feedback_submitted", {
        category: type,
        length: message.trim().length,
      });
      setStatusTone("success");
      setStatusMessage(data.message ?? "Feedback sent. Thank you!");
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatusTone("error");
      setStatusMessage(
        "Network unavailable. Try again when you have a connection."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <AppNav />

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase text-cyan-300">
            Help
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Get started quickly
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            What Can We Sing helps a pickup quartet find songs everyone can sing
            together right now.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-5">
          <h2 className="text-2xl font-semibold">Quick start</h2>
          <ol className="mt-4 space-y-3">
            {quickStartSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-slate-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-slate-950">
                  {index + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {helpSections.map((section) => (
            <article
              key={section.title}
              className="rounded-xl border border-white/10 bg-white/10 p-5"
            >
              <h2 className="text-lg font-semibold text-white">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {section.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/10 p-5">
          <div>
            <h2 className="text-2xl font-semibold">Send feedback</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Report a bug, describe confusing behavior, or suggest an
              improvement. A short note is plenty.
            </p>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-300">
              Feedback type
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as FeedbackType)}
              className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
            >
              {feedbackTypes.map((feedbackType) => (
                <option key={feedbackType}>{feedbackType}</option>
              ))}
            </select>
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-300">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={maxFeedbackMessageLength}
              rows={7}
              className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-300">
              Contact email
            </span>
            <input
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              type="email"
              className="mt-1 w-full rounded-xl bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2"
            />
          </label>

          <button
            type="button"
            onClick={sendFeedback}
            disabled={isSending}
            className="mt-6 w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
          >
            {isSending ? "Sending..." : "Send feedback"}
          </button>

          {statusMessage && (
            <p
              className={`mt-4 text-sm ${
                statusTone === "success"
                  ? "text-cyan-200"
                  : statusTone === "error"
                  ? "text-rose-200"
                  : "text-slate-300"
              }`}
            >
              {statusMessage}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
