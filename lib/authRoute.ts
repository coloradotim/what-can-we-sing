export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/auth/callback"
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
