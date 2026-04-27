export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/auth/callback" ||
    pathname === "/privacy"
  );
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
