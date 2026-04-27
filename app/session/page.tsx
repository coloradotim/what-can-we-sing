"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import { createSession } from "@/lib/sessionStore";

function makeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function SessionPage() {
  const [joinCode, setJoinCode] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const code = makeJoinCode();

      try {
        await createSession(code);
        setJoinCode(code);

        const joinUrl = `${window.location.origin}/join/${code}`;
        const qr = await QRCode.toDataURL(joinUrl);
        setQrUrl(qr);
      } catch (err) {
        console.error("Failed to create session", err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Creating session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-4">
          <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
            ← Back home
          </a>
          <SignOutButton />
        </div>

        <h1 className="mt-4 text-4xl font-bold">Start a session</h1>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6 text-center">
          {qrUrl && (
            <img
              src={qrUrl}
              alt="QR code"
              className="mx-auto rounded-xl bg-white p-4"
            />
          )}

          <p className="mt-6 text-sm text-slate-400">Session code</p>
          <p className="text-5xl font-bold tracking-widest text-cyan-300">
            {joinCode}
          </p>

          <a
            href={`/join/${joinCode}`}
            className="mt-6 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Join this session
          </a>
        </div>
      </div>
    </main>
  );
}
