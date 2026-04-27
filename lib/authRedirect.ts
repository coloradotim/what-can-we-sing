const DEFAULT_AUTH_REDIRECT_PATH = "/settings";

function normalizeSiteUrl(siteUrl: string | undefined): string | null {
  if (!siteUrl?.trim()) return null;

  try {
    return new URL(siteUrl.trim()).origin;
  } catch {
    return null;
  }
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function getSafeRedirectPath(search: string): string {
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
  const baseUrl = normalizeSiteUrl(siteUrl) ?? (isLocalDevelopmentOrigin(origin) ? origin : null);

  if (!baseUrl) return null;

  return new URL(getSafeRedirectPath(search), baseUrl).toString();
}
