export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback&") ||
    pathname === "/privacy"
  );
}

export function getNormalizedAuthCallbackUrl(requestUrl: URL): URL | null {
  if (!requestUrl.pathname.startsWith("/auth/callback&")) {
    return null;
  }

  const normalizedUrl = new URL(requestUrl);
  const malformedQuery = normalizedUrl.pathname.slice("/auth/callback&".length);
  const existingSearch = normalizedUrl.search.replace(/^\?/, "");
  const search = [malformedQuery, existingSearch].filter(Boolean).join("&");

  normalizedUrl.pathname = "/auth/callback";
  normalizedUrl.search = search ? `?${search}` : "";

  return normalizedUrl;
}

export function allowsMissingDisplayName(pathname: string): boolean {
  return (
    isPublicAuthPath(pathname) ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  );
}

export function getLoginRedirectUrl(requestUrl: URL): URL {
  const loginUrl = new URL(requestUrl);
  const destination = `${requestUrl.pathname}${requestUrl.search}`;

  loginUrl.pathname = "/login";
  loginUrl.search = "";

  if (destination !== "/") {
    loginUrl.searchParams.set("redirect", destination);
  }

  return loginUrl;
}

export function getSettingsRedirectUrl(requestUrl: URL): URL {
  const settingsUrl = new URL(requestUrl);
  const destination = `${requestUrl.pathname}${requestUrl.search}`;

  settingsUrl.pathname = "/settings";
  settingsUrl.search = "";

  if (destination !== "/settings") {
    settingsUrl.searchParams.set("redirect", destination);
  }

  return settingsUrl;
}
