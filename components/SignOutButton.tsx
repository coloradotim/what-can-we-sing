"use client";

import { getCurrentUser, signOut } from "@/lib/profileStore";
import { useEffect, useState } from "react";

export function SignOutButton({ className = "" }: { className?: string }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getCurrentUser();
        setIsLoggedIn(Boolean(user));
      } catch (err) {
        console.error(err);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error(err);
      setIsSigningOut(false);
    }
  }

  if (isLoading || !isLoggedIn) return null;

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={
        className ||
        "text-sm font-medium text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
      }
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
