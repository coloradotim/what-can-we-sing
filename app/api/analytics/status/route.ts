import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function configured(value: string | undefined) {
  return Boolean(value && value.trim());
}

export function GET() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  return NextResponse.json(
    {
      posthogConfigured: configured(posthogKey) && configured(posthogHost),
      hasPostHogKey: configured(posthogKey),
      hasPostHogHost: configured(posthogHost),
      posthogHost: posthogHost || null,
      vercelEnv: process.env.VERCEL_ENV || null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
