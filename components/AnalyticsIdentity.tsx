"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  getAnalyticsRoute,
  identifyAnalyticsUser,
  trackEvent,
} from "@/lib/analytics";
import { getCurrentUser } from "@/lib/profileStore";

function loggedInStorageKey(userId: string) {
  return `analytics:user_logged_in:${userId}`;
}

export function AnalyticsIdentity() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent("app_route_viewed", {
      route: getAnalyticsRoute(pathname),
    });
  }, [pathname]);

  useEffect(() => {
    async function identifyUser() {
      try {
        const user = await getCurrentUser();

        if (!user) return;

        identifyAnalyticsUser(user.id);

        const storageKey = loggedInStorageKey(user.id);
        if (window.sessionStorage.getItem(storageKey)) return;

        trackEvent("user_logged_in");
        window.sessionStorage.setItem(storageKey, "true");
      } catch (err) {
        console.error("Could not identify analytics user", err);
      }
    }

    identifyUser();
  }, []);

  return null;
}
