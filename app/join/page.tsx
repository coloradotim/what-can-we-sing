"use client";

import { AppNav } from "@/components/AppNav";
import {
  clearActiveQuartet,
  getActiveQuartet,
  type ActiveQuartet,
} from "@/lib/activeQuartet";
import { intentionalJoinStorageKey } from "@/lib/joinIntent";
import { parseJoinCode } from "@/lib/joinCode";
import { getCurrentUser } from "@/lib/profileStore";
import { trackEvent } from "@/lib/analytics";
import { removeParticipant } from "@/lib/sessionStore";
import { useEffect, useRef, useState } from "react";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorLike;

export default function JoinPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [pendingCode, setPendingCode] = useState("");
  const [activeQuartet, setActiveQuartet] = useState<ActiveQuartet | null>(null);
  const [leavingCurrent, setLeavingCurrent] = useState(false);
  const [message, setMessage] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");

  function goToQuartet(code: string) {
    const currentQuartet = getActiveQuartet();

    if (currentQuartet && currentQuartet.code !== code) {
      setPendingCode(code);
      setActiveQuartet(currentQuartet);
      setMessage("");
      setScannerOpen(false);
      return;
    }

    window.sessionStorage.setItem(intentionalJoinStorageKey(code), "true");
    window.location.href = `/join/${encodeURIComponent(code)}?intent=join`;
  }

  function joinQuartet() {
    const code = parseJoinCode(joinCode);

    if (!code) {
      setMessage("Enter the quartet code another singer shared with you.");
      return;
    }

    goToQuartet(code);
  }

  async function leaveCurrentAndContinue() {
    if (!activeQuartet || !pendingCode) return;

    trackEvent("quartet_leave_clicked", {
      session_id: activeQuartet.sessionId,
      source: "manual_join_existing_quartet",
    });
    setLeavingCurrent(true);
    setMessage("");

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error("You must be logged in to leave a quartet.");
      }

      trackEvent("quartet_leave_confirmed", {
        session_id: activeQuartet.sessionId,
        source: "manual_join_existing_quartet",
      });
      await removeParticipant(activeQuartet.sessionId, user.id);
      trackEvent("quartet_left", {
        session_id: activeQuartet.sessionId,
      });
      clearActiveQuartet();
      window.sessionStorage.setItem(
        intentionalJoinStorageKey(pendingCode),
        "true"
      );
      window.location.href = `/join/${encodeURIComponent(pendingCode)}?intent=join`;
    } catch (err) {
      console.error("Failed to leave current quartet", err);
      trackEvent("quartet_leave_failed", {
        session_id: activeQuartet.sessionId,
        source: "manual_join_existing_quartet",
      });
      setMessage(
        "Could not leave your current quartet. Check your connection and try again."
      );
      setLeavingCurrent(false);
    }
  }

  function closeScanner() {
    setScannerOpen(false);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("removed") === "1") {
      clearActiveQuartet();
      setMessage("You were removed from the quartet.");
    }
  }, []);

  useEffect(() => {
    if (!scannerOpen) return;

    let cancelled = false;

    async function startScanner() {
      setScannerMessage("Opening camera...");

      const BarcodeDetectorConstructor = (
        window as typeof window & {
          BarcodeDetector?: BarcodeDetectorConstructor;
        }
      ).BarcodeDetector;

      if (!BarcodeDetectorConstructor) {
        setScannerMessage(
          "This browser does not support in-app QR scanning. Use your camera app or enter the code manually."
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        const detector = new BarcodeDetectorConstructor({
          formats: ["qr_code"],
        });

        setScannerMessage("Point your camera at the quartet QR code.");

        async function scanFrame() {
          if (cancelled || !videoRef.current) return;

          try {
            const results = await detector.detect(videoRef.current);
            const rawValue = results[0]?.rawValue;
            const code = rawValue ? parseJoinCode(rawValue) : null;

            if (code) {
              goToQuartet(code);
              return;
            }
          } catch (err) {
            console.error("QR scan failed", err);
            setScannerMessage(
              "Could not read a QR code yet. Try holding the camera steady."
            );
          }

          scanFrameRef.current = window.requestAnimationFrame(scanFrame);
        }

        scanFrameRef.current = window.requestAnimationFrame(scanFrame);
      } catch (err) {
        console.error("Camera permission failed", err);
        setScannerMessage(
          "Could not open the camera. Check browser permission or enter the code manually."
        );
      }
    }

    startScanner();

    return () => {
      cancelled = true;

      if (scanFrameRef.current) {
        window.cancelAnimationFrame(scanFrameRef.current);
        scanFrameRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scannerOpen]);

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

          <button
            type="button"
            onClick={() => {
              setScannerMessage("");
              setScannerOpen(true);
            }}
            className="mt-3 w-full rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700"
          >
            Scan QR code
          </button>

          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
        </section>

        {scannerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
            className="fixed inset-0 z-50 flex bg-slate-950 text-white"
          >
            <div className="flex min-h-full w-full flex-col">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 p-4">
                <div>
                  <h2 id="qr-scanner-title" className="text-xl font-semibold">
                    Scan QR code
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Scan the quartet QR code from another singer&apos;s screen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeScanner}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>

              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-x-8 top-1/2 aspect-square max-h-[70vw] -translate-y-1/2 rounded-3xl border-4 border-cyan-300/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)] sm:inset-x-auto sm:h-80 sm:w-80" />
              </div>

              <div className="border-t border-white/10 p-4">
                <p className="text-sm text-slate-300">
                  {scannerMessage || "Camera preview will appear here."}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeQuartet && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-quartet-title"
            className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5"
          >
            <h2 id="active-quartet-title" className="text-xl font-semibold">
              You are already in a quartet
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Return to quartet {activeQuartet.code}, or leave it before
              joining quartet {pendingCode}.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <a
                href={`/join/${activeQuartet.code}`}
                className="rounded-xl bg-cyan-300 px-5 py-3 text-center font-semibold text-slate-950 hover:bg-cyan-200"
              >
                Return to current quartet
              </a>
              <button
                type="button"
                onClick={leaveCurrentAndContinue}
                disabled={leavingCurrent}
                className="rounded-xl bg-slate-800 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                {leavingCurrent
                  ? "Leaving..."
                  : "Leave current quartet and continue"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
