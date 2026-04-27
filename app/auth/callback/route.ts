import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthCallbackNextPath } from "@/lib/authRedirect";

export async function GET(request: NextRequest) {
  const nextPath = getAuthCallbackNextPath(request.nextUrl.search);
  const code = request.nextUrl.searchParams.get("code");
  const successUrl = new URL(nextPath, request.url);
  const loginUrl = new URL("/login", request.url);

  loginUrl.searchParams.set("redirect", nextPath);

  if (!code) {
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.redirect(successUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          response = NextResponse.redirect(successUrl);

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headersToSet).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
