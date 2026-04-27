const DEFAULT_AUTH_REDIRECT_PATH = "/";

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

  return new URL(redirectPath, baseUrl).toString();
}
