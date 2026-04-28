"use client";

import { AppNav } from "@/components/AppNav";
import {
  feedbackTypes,
  maxFeedbackMessageLength,
  type FeedbackType,
} from "@/lib/feedback";
import { getCurrentUser } from "@/lib/profileStore";
import { useEffect, useState } from "react";

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("Bug report");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">(
    "info"
  );
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
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

      setStatusTone("success");
      setStatusMessage(data.message ?? "Feedback sent. Thank you!");
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatusTone("error");
      setStatusMessage("Network unavailable. Try again when you have a connection.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <AppNav />

        <h1 className="mt-4 text-4xl font-bold">Send feedback</h1>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5">
          <label className="block">
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
