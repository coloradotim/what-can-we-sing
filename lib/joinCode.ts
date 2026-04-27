const JOIN_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

function normalizeJoinCode(value: string) {
  return value.trim().toUpperCase();
}

export function parseJoinCode(value: string): string | null {
  const normalized = normalizeJoinCode(value);

  if (JOIN_CODE_PATTERN.test(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(value);
    const [, route, code] = url.pathname.split("/");

    if (route !== "join" || !code) return null;

    const parsedCode = normalizeJoinCode(decodeURIComponent(code));
    return JOIN_CODE_PATTERN.test(parsedCode) ? parsedCode : null;
  } catch {
    return null;
  }
}
