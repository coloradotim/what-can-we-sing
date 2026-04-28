import { createServerClient } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const privateDestinationEmail = "owner-private@example.com";

function feedbackRequest(body: unknown) {
  return {
    json: async () => body,
    cookies: {
      getAll: () => [],
    },
  } as never;
}

async function responseBody(response: Response) {
  return JSON.stringify(await response.json());
}

describe("feedback API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };

    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not expose the feedback destination when email is not configured", async () => {
    process.env.FEEDBACK_TO_EMAIL = privateDestinationEmail;
    delete process.env.FEEDBACK_FROM_EMAIL;
    delete process.env.RESEND_API_KEY;

    const response = await POST(
      feedbackRequest({
        type: "Bug report",
        message: "The feedback form broke.",
      })
    );

    expect(response.status).toBe(503);
    expect(await responseBody(response)).not.toContain(privateDestinationEmail);
  });

  it("does not expose the feedback destination when Resend fails", async () => {
    process.env.FEEDBACK_TO_EMAIL = privateDestinationEmail;
    process.env.FEEDBACK_FROM_EMAIL = "What Can We Sing <feedback@example.com>";
    process.env.RESEND_API_KEY = "resend-key";
    vi.mocked(fetch).mockResolvedValue(
      new Response(`Could not deliver to ${privateDestinationEmail}`, {
        status: 422,
        statusText: "Unprocessable Entity",
      })
    );

    const response = await POST(
      feedbackRequest({
        type: "Bug report",
        message: "The feedback form broke.",
      })
    );

    expect(response.status).toBe(502);
    expect(await responseBody(response)).not.toContain(privateDestinationEmail);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      privateDestinationEmail
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "Could not deliver"
    );
  });

  it("uses the server-only destination email when sending feedback", async () => {
    process.env.FEEDBACK_TO_EMAIL = privateDestinationEmail;
    process.env.FEEDBACK_FROM_EMAIL = "What Can We Sing <feedback@example.com>";
    process.env.RESEND_API_KEY = "resend-key";
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const response = await POST(
      feedbackRequest({
        type: "Feature idea",
        message: "Add a pitch pipe.",
        contactEmail: "singer@example.com",
      })
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: expect.stringContaining(`"to":"${privateDestinationEmail}"`),
      })
    );
    expect(await responseBody(response)).not.toContain(privateDestinationEmail);
  });

  it("ignores non-form fields in the feedback request body", async () => {
    process.env.FEEDBACK_TO_EMAIL = privateDestinationEmail;
    process.env.FEEDBACK_FROM_EMAIL = "What Can We Sing <feedback@example.com>";
    process.env.RESEND_API_KEY = "resend-key";
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await POST(
      feedbackRequest({
        type: "General feedback",
        message: "Nice and simple.",
        contactEmail: "singer@example.com",
        path: "https://example.com/feedback",
      })
    );

    const emailRequest = JSON.parse(
      vi.mocked(fetch).mock.calls[0][1]?.body as string
    );

    expect(emailRequest.text).not.toContain("https://example.com/feedback");
  });
});
