"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ACTIVE_QUARTET_CHANGED_EVENT,
  clearActiveQuartet,
  getActiveQuartet,
  type ActiveQuartet,
} from "@/lib/activeQuartet";
import { getCurrentUser } from "@/lib/profileStore";
import { removeParticipant } from "@/lib/sessionStore";

function isViewingActiveQuartet(pathname: string, code: string) {
  return pathname.toUpperCase() === `/JOIN/${code.toUpperCase()}`;
}

export function ActiveQuartetIndicator() {
  const pathname = usePathname();
  const [activeQuartet, setActiveQuartet] = useState<ActiveQuartet | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function syncActiveQuartet() {
      setActiveQuartet(getActiveQuartet());
    }

    syncActiveQuartet();

    window.addEventListener("storage", syncActiveQuartet);
    window.addEventListener(ACTIVE_QUARTET_CHANGED_EVENT, syncActiveQuartet);

    return () => {
      window.removeEventListener("storage", syncActiveQuartet);
      window.removeEventListener(ACTIVE_QUARTET_CHANGED_EVENT, syncActiveQuartet);
    };
  }, []);

  async function leaveQuartet() {
    if (!activeQuartet) return;

    setLeaving(true);
    setMessage("");

    try {
      const user = await getCurrentUser();

      if (user) {
        await removeParticipant(activeQuartet.sessionId, user.id);
      }

      clearActiveQuartet();
      setActiveQuartet(null);

      if (window.location.pathname === `/join/${activeQuartet.code}`) {
        window.location.href = "/?leftQuartet=1";
      }
    } catch (err) {
      console.error("Failed to leave active quartet", err);
      setMessage("Could not leave quartet. Try again.");
    } finally {
      setLeaving(false);
    }
  }

  if (!activeQuartet) return null;

  if (isViewingActiveQuartet(pathname, activeQuartet.code)) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-100">
          In quartet{" "}
          <span className="text-cyan-200">{activeQuartet.code}</span>
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href={`/join/${activeQuartet.code}`}
            className="rounded-lg bg-cyan-300 px-4 py-2 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Return to quartet
          </a>
          <button
            type="button"
            onClick={leaveQuartet}
            disabled={leaving}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            {leaving ? "Leaving..." : "Leave quartet"}
          </button>
        </div>
      </div>

      {message && <p className="mt-2 text-sm text-rose-100">{message}</p>}
    </div>
  );
}
