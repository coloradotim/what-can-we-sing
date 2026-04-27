const DEFAULT_AUTH_REDIRECT_PATH = "/";
const AUTH_CALLBACK_PATH = "/auth/callback";

function normalizeSiteUrl(siteUrl: string | undefined): string | null {
  if (!siteUrl?.trim()) return null;

  try {
    const url = new URL(siteUrl.trim());
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getPostLoginRedirectPath(search: string): string {
  const redirect = new URLSearchParams(search).get("redirect");

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return redirect;
}

export function getAuthCallbackNextPath(search: string): string {
  const next = new URLSearchParams(search).get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return next;
}

export function getMagicLinkRedirectUrl({
  siteUrl,
  origin,
  search,
}: {
  siteUrl: string | undefined;
  origin: string;
  search: string;
}): string | null {
  const redirectPath = getPostLoginRedirectPath(search);
  const baseUrl = normalizeSiteUrl(siteUrl) ?? (isLocalOrigin(origin) ? origin : null);

  if (!baseUrl) return null;

  const callbackUrl = new URL(AUTH_CALLBACK_PATH, baseUrl);

  if (redirectPath !== DEFAULT_AUTH_REDIRECT_PATH) {
    callbackUrl.searchParams.set("next", redirectPath);
  }

  return callbackUrl.toString();
}
