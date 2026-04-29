"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/profileStore";

export function PublicAwareAppNav() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthState() {
      try {
        const user = await getCurrentUser();

        if (isMounted) {
          setIsSignedIn(Boolean(user));
        }
      } catch (err) {
        console.error("Could not load navigation auth state", err);

        if (isMounted) {
          setIsSignedIn(false);
        }
      }
    }

    loadAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  return <AppNav variant={isSignedIn ? "app" : "public"} />;
}
