const DEFAULT_AUTH_REDIRECT_PATH = "/";

const disallowedAuthRedirectPaths = ["/login", "/auth/callback"];
const disallowedMalformedAuthRedirectPathPrefixes = ["/auth/callback&"];

export function getPostLoginRedirectPath(search: string): string {
  const redirect = new URLSearchParams(search).get("redirect");

  if (!isSafeAppRedirectPath(redirect)) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  return redirect;
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
