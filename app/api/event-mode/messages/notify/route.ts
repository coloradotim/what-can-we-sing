import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { formatEventModeMessageNotificationEmail } from "@/lib/eventModeNotificationEmail";

const resendApiUrl = "https://api.resend.com/emails";

type EventModeMessageRow = {
  id: string;
  event_id: string;
  sender_user_id: string;
  recipient_user_id: string;
};

type EventModeEventRow = {
  id: string;
  name: string;
  join_code: string;
};

type ProfileRow = {
  display_name: string | null;
};

type NotificationRow = {
  id: string;
};

function jsonResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function cleanMessageId(value: unknown) {
  const messageId = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    messageId
  )
    ? messageId
    : null;
}

function appOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) return new URL(configuredOrigin).origin;
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  let messageId: string | null = null;

  try {
    const body = await request.json();
    messageId = cleanMessageId(body?.messageId);
  } catch {
    return jsonResponse("Could not read notification request.", 400);
  }

  if (!messageId) {
    return jsonResponse("Message id is required.", 400);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EVENT_MODE_MESSAGE_FROM_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !resendApiKey ||
    !fromEmail ||
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey
  ) {
    return jsonResponse("Event Mode message email is not configured yet.", 503);
  }

  const response = NextResponse.next();
  const userClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse("You must be logged in to send notifications.", 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: message, error: messageError } = await adminClient
    .from("event_mode_messages")
    .select("id,event_id,sender_user_id,recipient_user_id")
    .eq("id", messageId)
    .maybeSingle<EventModeMessageRow>();

  if (messageError) {
    console.error("Event Mode notification message lookup failed", {
      status: messageError.code,
    });
    return jsonResponse("Could not send message notification.", 502);
  }

  if (!message || message.sender_user_id !== user.id) {
    return jsonResponse("Message notification is not available.", 404);
  }

  const [{ data: event, error: eventError }, { data: senderProfile }] =
    await Promise.all([
      adminClient
        .from("event_mode_events")
        .select("id,name,join_code")
        .eq("id", message.event_id)
        .maybeSingle<EventModeEventRow>(),
      adminClient
        .from("profiles")
        .select("display_name")
        .eq("id", message.sender_user_id)
        .maybeSingle<ProfileRow>(),
    ]);

  if (eventError || !event) {
    console.error("Event Mode notification event lookup failed", {
      status: eventError?.code,
    });
    return jsonResponse("Could not send message notification.", 502);
  }

  const { data: recipientResult, error: recipientError } =
    await adminClient.auth.admin.getUserById(message.recipient_user_id);
  const recipientEmail = recipientResult.user?.email;

  if (recipientError || !recipientEmail) {
    console.error("Event Mode notification recipient lookup failed", {
      status: recipientError?.status,
    });
    return jsonResponse("Could not send message notification.", 502);
  }

  const eventUrl = new URL(`/event-mode/${event.join_code}`, appOrigin(request));
  const senderDisplayName = senderProfile?.display_name ?? "A singer";
  const emailText = formatEventModeMessageNotificationEmail({
    eventName: event.name,
    senderDisplayName,
    eventUrl: eventUrl.toString(),
  });
  const { data: notification, error: notificationError } = await adminClient
    .from("event_mode_message_notifications")
    .insert({
      message_id: message.id,
      event_id: message.event_id,
      sender_user_id: message.sender_user_id,
      recipient_user_id: message.recipient_user_id,
      status: "pending",
    })
    .select("id")
    .maybeSingle<NotificationRow>();

  if (notificationError) {
    if (notificationError.code === "23505") {
      return jsonResponse("Message notification already handled.", 200);
    }

    console.error("Event Mode notification log insert failed", {
      status: notificationError.code,
    });
    return jsonResponse("Could not send message notification.", 502);
  }

  try {
    const resendResponse = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        subject: `${senderDisplayName} sent you a What Can We Sing message`,
        text: emailText,
      }),
    });

    if (!resendResponse.ok) {
      if (notification) {
        await adminClient
          .from("event_mode_message_notifications")
          .update({
            status: "failed",
            error_status: resendResponse.status,
          })
          .eq("id", notification.id);
      }
      console.error("Event Mode notification email failed", {
        status: resendResponse.status,
        statusText: resendResponse.statusText,
      });
      return jsonResponse("Could not send message notification.", 502);
    }

    let providerMessageId: string | null = null;
    try {
      const result = await resendResponse.json();
      providerMessageId = typeof result?.id === "string" ? result.id : null;
    } catch {
      providerMessageId = null;
    }

    if (notification) {
      await adminClient
        .from("event_mode_message_notifications")
        .update({
          status: "sent",
          provider_message_id: providerMessageId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", notification.id);
    }

    return jsonResponse("Message notification sent.", 200);
  } catch (err) {
    if (notification) {
      await adminClient
        .from("event_mode_message_notifications")
        .update({ status: "failed" })
        .eq("id", notification.id);
    }
    console.error("Event Mode notification email request failed", err);
    return jsonResponse("Could not send message notification.", 502);
  }
}
