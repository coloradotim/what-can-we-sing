const DEFAULT_LOGIN_REDIRECT_PATH = "/";

export function getPostLoginRedirectPath(search: string): string {
  const redirect = new URLSearchParams(search).get("redirect");

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return DEFAULT_LOGIN_REDIRECT_PATH;
  }

  return redirect;
}

export function getPostLoginRedirectUrl(origin: string, search: string): string {
  return new URL(getPostLoginRedirectPath(search), origin).toString();
}
