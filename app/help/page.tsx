"use client";

import { PublicAwareAppNav } from "@/components/PublicAwareAppNav";
import { trackEvent } from "@/lib/analytics";
import {
  feedbackTypes,
  maxFeedbackMessageLength,
  type FeedbackType,
} from "@/lib/feedback";
import {
  feedbackHelpCopy,
  helpGuideSections,
  helpNavItems,
  helpWelcomeCopy,
} from "@/lib/helpContent";
import { getCurrentUser } from "@/lib/profileStore";
import { useEffect, useState } from "react";

const helpIntroParagraphClass = "mt-3 text-base leading-7 text-slate-300";
const helpIntroInsetClass = "mx-auto max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-3rem)]";

export default function HelpPage() {
  const [type, setType] = useState<FeedbackType>("General feedback");
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
        trackEvent("feedback_failed", {
          category: type,
          status_code: response.status,
        });
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
      trackEvent("feedback_failed", {
        category: type,
        reason: "network",
      });
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
        <PublicAwareAppNav />

        <header className={`mt-8 ${helpIntroInsetClass}`}>
          <p className="text-sm font-semibold uppercase text-cyan-300">
            Help
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            How to use What Can We Sing
          </h1>
          <p className={helpIntroParagraphClass}>
            What Can We Sing helps a pickup quartet quickly answer the question:
            what can we sing together right now?
          </p>
          <p className={helpIntroParagraphClass}>
            Each singer adds the songs they know, the voicing, the parts they
            can sing, and how confident they feel. When singers join the same
            quartet, the app compares everyone&apos;s repertoire and shows songs
            where the required parts are covered by different people.
          </p>
          <p className={helpIntroParagraphClass}>
            {helpWelcomeCopy}
          </p>
          <p className={helpIntroParagraphClass}>
            If the app helps you, confuses you, or gives you an idea for
            something better, please send a note using the{" "}
            <a
              href="#feedback"
              className="font-semibold text-cyan-200 hover:text-cyan-100"
            >
              feedback form
            </a>{" "}
            at the bottom of this page.
          </p>
        </header>

        <nav
          aria-label="Help page sections"
          className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <h2 className="text-sm font-semibold uppercase text-slate-300">
            On this page
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {helpNavItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:border-cyan-200 hover:bg-cyan-300/20"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <section className="mt-8 space-y-6">
          {helpGuideSections.map((section) => (
            <article
              key={section.title}
              id={section.id}
              className="scroll-mt-6 rounded-2xl border border-white/10 bg-white/10 p-5 sm:p-6"
            >
              <p className="text-sm font-semibold uppercase text-cyan-300">
                {section.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {section.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-300">
                {section.intro}
              </p>

              <div className="mt-5 space-y-5">
                {section.topics.map((topic) => (
                  <section
                    key={topic.title}
                    className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <h3 className="text-lg font-semibold text-slate-100">
                      {topic.title}
                    </h3>
                    <div className="mt-2 space-y-3 text-base leading-7 text-slate-300">
                      {topic.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                    {topic.bullets && (
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-slate-300">
                        {topic.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section
          id="feedback"
          className="mt-10 scroll-mt-6 rounded-2xl border border-white/10 bg-white/10 p-5"
        >
          <div>
            <h2 className="text-2xl font-semibold">Send feedback</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {feedbackHelpCopy}
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
