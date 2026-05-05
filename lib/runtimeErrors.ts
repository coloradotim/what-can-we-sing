export type RuntimeErrorCategory =
  | "auth_email_rate_limited"
  | "auth_email_quota_exceeded"
  | "database_unavailable"
  | "database_read_only_or_quota"
  | "rate_limited"
  | "network_unavailable"
  | "unknown_service_error";

export type RuntimeErrorOperation =
  | "auth_email"
  | "database_read"
  | "database_write"
  | "realtime"
  | "runtime";

export type RuntimeErrorInfo = {
  category: RuntimeErrorCategory;
  operation: RuntimeErrorOperation;
  message: string;
};

const EMAIL_LIMIT_MESSAGE =
  "We could not send the login email right now. This may be a temporary email limit or rate limit. Wait a minute and try again, or ask the event organizer for help.";

const DATABASE_READ_MESSAGE =
  "Could not load songs right now. Your saved songs are probably still there; the app just could not reach the database.";

const DATABASE_WRITE_LIMIT_MESSAGE =
  "The app can read data, but could not save changes right now. This may be a database usage limit or temporary service issue. Try again shortly or ask the organizer for help.";

const NETWORK_MESSAGE =
  "Network unavailable. Try again when you have a connection.";

const UNKNOWN_SERVICE_MESSAGE =
  "The app could not reach a required service right now. Try again shortly or ask the organizer for help.";

function errorText(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function classifyRuntimeError(
  error: unknown,
  operation: RuntimeErrorOperation
): RuntimeErrorInfo {
  const text = errorText(error).toLowerCase();

  if (
    text.includes("network") ||
    text.includes("failed to fetch") ||
    text.includes("fetch failed") ||
    text.includes("offline")
  ) {
    return {
      category: "network_unavailable",
      operation,
      message: NETWORK_MESSAGE,
    };
  }

  if (
    text.includes("429") ||
    text.includes("too many requests") ||
    text.includes("rate limit") ||
    text.includes("rate-limit") ||
    text.includes("throttle")
  ) {
    return {
      category:
        operation === "auth_email" ? "auth_email_rate_limited" : "rate_limited",
      operation,
      message: operation === "auth_email" ? EMAIL_LIMIT_MESSAGE : UNKNOWN_SERVICE_MESSAGE,
    };
  }

  if (
    text.includes("quota") ||
    text.includes("usage limit") ||
    text.includes("resource exhausted") ||
    text.includes("email limit")
  ) {
    return {
      category:
        operation === "auth_email"
          ? "auth_email_quota_exceeded"
          : operation === "database_write"
            ? "database_read_only_or_quota"
            : "rate_limited",
      operation,
      message:
        operation === "auth_email"
          ? EMAIL_LIMIT_MESSAGE
          : operation === "database_write"
            ? DATABASE_WRITE_LIMIT_MESSAGE
            : UNKNOWN_SERVICE_MESSAGE,
    };
  }

  if (
    text.includes("read-only transaction") ||
    text.includes("read only transaction") ||
    text.includes("readonly") ||
    text.includes("read-only")
  ) {
    return {
      category: "database_read_only_or_quota",
      operation,
      message: DATABASE_WRITE_LIMIT_MESSAGE,
    };
  }

  if (
    operation === "database_read" &&
    (text.includes("database") ||
      text.includes("postgrest") ||
      text.includes("supabase") ||
      text.includes("jwt") ||
      text.includes("session") ||
      text.includes("project") ||
      text.includes("unavailable"))
  ) {
    return {
      category: "database_unavailable",
      operation,
      message: DATABASE_READ_MESSAGE,
    };
  }

  if (operation === "database_read") {
    return {
      category: "database_unavailable",
      operation,
      message: DATABASE_READ_MESSAGE,
    };
  }

  if (operation === "database_write") {
    return {
      category: "unknown_service_error",
      operation,
      message:
        "Could not save changes right now. Try again shortly or ask the organizer for help.",
    };
  }

  if (operation === "auth_email") {
    return {
      category: "unknown_service_error",
      operation,
      message: EMAIL_LIMIT_MESSAGE,
    };
  }

  return {
    category: "unknown_service_error",
    operation,
    message: UNKNOWN_SERVICE_MESSAGE,
  };
}

export function serviceErrorMessage(
  error: unknown,
  operation: RuntimeErrorOperation
) {
  return classifyRuntimeError(error, operation).message;
}
