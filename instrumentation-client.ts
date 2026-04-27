import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: false,
    capture_exceptions: true,
    capture_pageview: false,
    defaults: "2025-05-24",
    loaded: (posthogInstance) => {
      if (process.env.NODE_ENV === "development") {
        posthogInstance.debug();
      }
    },
  });
}
