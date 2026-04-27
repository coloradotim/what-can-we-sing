export type ExpiringSession = {
  created_at: string;
  last_activity_at?: string | null;
};

export const QUARTET_EXPIRATION_HOURS = 24;
export const QUARTET_EXPIRATION_MS = QUARTET_EXPIRATION_HOURS * 60 * 60 * 1000;

export function sessionLastActivityAt(session: ExpiringSession): string {
  return session.last_activity_at ?? session.created_at;
}

export function isSessionExpired(session: ExpiringSession, now = new Date()) {
  const lastActivity = new Date(sessionLastActivityAt(session)).getTime();

  if (Number.isNaN(lastActivity)) return false;

  return now.getTime() - lastActivity >= QUARTET_EXPIRATION_MS;
}

export function sessionExpirationLabel(
  session: ExpiringSession,
  now = new Date()
) {
  const lastActivity = new Date(sessionLastActivityAt(session)).getTime();

  if (Number.isNaN(lastActivity)) return "Expires in 24h";

  const remainingMs = QUARTET_EXPIRATION_MS - (now.getTime() - lastActivity);

  if (remainingMs <= 0) return "Expired";
  if (remainingMs < 60 * 60 * 1000) return "Expires soon";

  return `Expires in ${Math.ceil(remainingMs / (60 * 60 * 1000))}h`;
}
