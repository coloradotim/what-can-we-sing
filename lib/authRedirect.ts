const DEFAULT_AUTH_REDIRECT_PATH = "/";
const AUTH_CALLBACK_PATH = "/auth/callback";

const disallowedAuthRedirectPaths = ["/login", "/auth/callback"];
const disallowedMalformedAuthRedirectPathPrefixes = ["/auth/callback&"];

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

  if (!isSafeAppRedirectPath(redirect)) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return redirect;
}

export function getAuthCallbackNextPath(search: string): string {
  const next = new URLSearchParams(search).get("next");

  if (!isSafeAppRedirectPath(next)) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return next;
}

export function isSafeAppRedirectPath(path: string | null): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;

  const { pathname } = new URL(path, "https://example.com");

  if (
    disallowedMalformedAuthRedirectPathPrefixes.some((disallowedPrefix) =>
      pathname.startsWith(disallowedPrefix)
    )
  ) {
    return false;
  }

  return !disallowedAuthRedirectPaths.some(
    (disallowedPath) =>
      pathname === disallowedPath || pathname.startsWith(`${disallowedPath}/`)
  );
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

  callbackUrl.searchParams.set("next", redirectPath);

  return callbackUrl.toString();
}
