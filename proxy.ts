import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  allowsMissingDisplayName,
  getLoginRedirectUrl,
  getSettingsRedirectUrl,
  isPublicAuthPath,
} from "@/lib/authRoute";

export async function proxy(request: NextRequest) {
  if (isPublicAuthPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(getLoginRedirectUrl(request.nextUrl));
  }

  if (!allowsMissingDisplayName(request.nextUrl.pathname)) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile?.display_name?.trim()) {
      return NextResponse.redirect(getSettingsRedirectUrl(request.nextUrl));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
