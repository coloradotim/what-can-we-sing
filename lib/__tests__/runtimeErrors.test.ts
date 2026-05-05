import { describe, expect, it } from "vitest";
import { classifyRuntimeError, serviceErrorMessage } from "../runtimeErrors";

describe("runtime error classification", () => {
  it("recognizes auth email rate limits and quota failures", () => {
    expect(
      classifyRuntimeError("429 Too Many Requests", "auth_email").category
    ).toBe("auth_email_rate_limited");
    expect(classifyRuntimeError("daily email quota exceeded", "auth_email")).toMatchObject({
      category: "auth_email_quota_exceeded",
      message: expect.stringContaining("login email"),
    });
  });

  it("recognizes database read and write service-cap failures", () => {
    expect(
      classifyRuntimeError("Supabase project unavailable", "database_read")
        .message
    ).toContain("saved songs are probably still there");
    expect(
      classifyRuntimeError("cannot execute INSERT in a read-only transaction", "database_write")
        .category
    ).toBe("database_read_only_or_quota");
    expect(serviceErrorMessage("quota exceeded", "database_write")).toContain(
      "could not save changes"
    );
  });

  it("recognizes network failures without exposing raw provider text", () => {
    const info = classifyRuntimeError(new Error("Failed to fetch"), "runtime");

    expect(info.category).toBe("network_unavailable");
    expect(info.message).toBe(
      "Network unavailable. Try again when you have a connection."
    );
  });
});
