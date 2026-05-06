import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const messageId = "11111111-1111-4111-8111-111111111111";
const privateRecipientEmail = "recipient-private@example.com";
const privateMessageBody = "Meet me by the lobby at 7 with my phone 555-1234.";
const senderEmail = "sender-private@example.com";

function notifyRequest(body: unknown) {
  return {
    url: "https://www.whatcanwesing.com/api/event-mode/messages/notify",
    json: async () => body,
    cookies: {
      getAll: () => [],
    },
  } as never;
}

function tableResult(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

async function responseBody(response: Response) {
  return JSON.stringify(await response.json());
}

describe("Event Mode message notification API", () => {
  const originalEnv = process.env;
  let adminClient: {
    from: ReturnType<typeof vi.fn>;
    auth: { admin: { getUserById: ReturnType<typeof vi.fn> } };
  };
  let notificationInsertError: { code: string } | null;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SITE_URL: "https://www.whatcanwesing.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      RESEND_API_KEY: "resend-key",
      EVENT_MODE_MESSAGE_FROM_EMAIL:
        "What Can We Sing <messages@example.com>",
    };
    notificationInsertError = null;

    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "sender-user" } },
          error: null,
        }),
      },
    } as never);

    adminClient = {
      from: vi.fn((table: string) => {
        if (table === "event_mode_messages") {
          return tableResult({
            id: messageId,
            event_id: "event-1",
            sender_user_id: "sender-user",
            recipient_user_id: "recipient-user",
          });
        }
        if (table === "event_mode_events") {
          return tableResult({
            id: "event-1",
            name: "RMD Fall Convention",
            join_code: "ABC123",
          });
        }
        if (table === "profiles") {
          return tableResult({ display_name: "Tim Singer" });
        }
        if (table === "event_mode_message_notifications") {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: notificationInsertError
                ? null
                : { id: "notification-1" },
              error: notificationInsertError,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: privateRecipientEmail } },
            error: null,
          }),
        },
      },
    };
    vi.mocked(createClient).mockReturnValue(adminClient as never);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a private notification link without message body or sender contact info", async () => {
    const response = await POST(notifyRequest({ messageId, body: privateMessageBody }));

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: expect.stringContaining(`"to":"${privateRecipientEmail}"`),
      })
    );

    const emailRequest = JSON.parse(
      vi.mocked(fetch).mock.calls[0][1]?.body as string
    );
    expect(emailRequest.text).toContain(
      "https://www.whatcanwesing.com/event-mode/ABC123"
    );
    expect(emailRequest.text).toContain("does not include the message text");
    expect(emailRequest.text).not.toContain(privateMessageBody);
    expect(emailRequest.text).not.toContain(senderEmail);
    expect(emailRequest.reply_to).toBeUndefined();
  });

  it("does not send when the logged-in user is not the message sender", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "recipient-user" } },
          error: null,
        }),
      },
    } as never);

    const response = await POST(notifyRequest({ messageId }));

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not expose recipient addresses or provider body on Resend failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(`Could not deliver to ${privateRecipientEmail}`, {
        status: 422,
        statusText: "Unprocessable Entity",
      })
    );

    const response = await POST(notifyRequest({ messageId }));

    expect(response.status).toBe(502);
    expect(await responseBody(response)).not.toContain(privateRecipientEmail);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      privateRecipientEmail
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "Could not deliver"
    );
  });

  it("treats duplicate notification requests as already handled", async () => {
    notificationInsertError = { code: "23505" };

    const response = await POST(notifyRequest({ messageId }));

    expect(response.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not expose server-only configuration values when email is not configured", async () => {
    delete process.env.EVENT_MODE_MESSAGE_FROM_EMAIL;

    const response = await POST(notifyRequest({ messageId }));

    expect(response.status).toBe(503);
    expect(await responseBody(response)).not.toContain("messages@example.com");
    expect(fetch).not.toHaveBeenCalled();
  });
});
