import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  formatFeedbackEmailText,
  validateFeedbackSubmission,
} from "../../../lib/feedback";

const resendApiUrl = "https://api.resend.com/emails";

function jsonResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: NextRequest) {
  let submission;

  try {
    const body = await request.json();

    submission = validateFeedbackSubmission({
      type: body?.type,
      message: body?.message,
      contactEmail: body?.contactEmail,
    });
  } catch (err) {
    return jsonResponse(
      err instanceof Error ? err.message : "Could not read feedback.",
      400
    );
  }

  const feedbackToEmail = process.env.FEEDBACK_TO_EMAIL;
  const feedbackFromEmail = process.env.FEEDBACK_FROM_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!feedbackToEmail || !feedbackFromEmail || !resendApiKey) {
    return jsonResponse("Feedback email is not configured yet.", 503);
  }

  let userId: string | undefined;
  let displayName: string | undefined;

  try {
    const response = NextResponse.next();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    userId = user?.id;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      displayName = profile?.display_name;
    }
  } catch (err) {
    console.error("Could not load feedback user context", err);
  }

  const emailText = formatFeedbackEmailText(submission, {
    userId,
    displayName,
    timestamp: new Date().toISOString(),
  });

  try {
    const response = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: feedbackFromEmail,
        to: feedbackToEmail,
        subject: `What Can We Sing feedback: ${submission.type}`,
        text: emailText,
        reply_to: submission.contactEmail,
      }),
    });

    if (!response.ok) {
      console.error("Feedback email failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return jsonResponse("Could not send feedback. Please try again.", 502);
    }

    return jsonResponse("Feedback sent. Thank you!", 200);
  } catch (err) {
    console.error("Feedback email request failed", err);
    return jsonResponse("Could not send feedback. Please try again.", 502);
  }
}
