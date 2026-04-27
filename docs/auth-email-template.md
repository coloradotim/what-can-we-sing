# Supabase Auth Email Templates

This project does not include a checked-in Supabase `config.toml`, so the hosted Supabase Auth email template must be configured in the Supabase dashboard.

## Magic Link

In Supabase, go to **Authentication > Email Templates > Magic Link** and use this template.

Subject:

```text
Log in to What Can We Sing
```

Body:

```html
<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <h2 style="margin: 0 0 16px;">Log in to What Can We Sing</h2>
  <p style="margin: 0 0 16px;">
    Click the button below to log in to What Can We Sing.
  </p>
  <p style="margin: 0 0 24px;">
    <a
      href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email"
      style="display: inline-block; border-radius: 8px; background: #67e8f9; color: #0f172a; font-weight: 700; padding: 12px 18px; text-decoration: none;"
    >
      Log in to What Can We Sing
    </a>
  </p>
  <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">
    If the button does not work, copy and paste this link into your browser.
  </p>
  <p style="margin: 0; font-size: 14px; word-break: break-all;">
    <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email" style="color: #0369a1;">{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email</a>
  </p>
</div>
```

Supabase's server-side auth guidance recommends sending `{{ .TokenHash }}` to an app callback route for PKCE/SSR flows. This template uses `{{ .RedirectTo }}` so the app's `emailRedirectTo` value, including any intended `next` path, is preserved. Keep the `token_hash={{ .TokenHash }}` and `type=email` query parameters in both links.

## Confirm Signup

New-user signup confirmation uses a different template and usually does not
include the app-generated `next` query parameter. In Supabase, go to
**Authentication > Email Templates > Confirm signup** and use `?` before the
first query parameter:

```html
<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <h2 style="margin: 0 0 16px;">What Can We Sing</h2>
  <p style="margin: 0 0 16px;">
    Click the button below to confirm your account and get started.
  </p>
  <p style="margin: 0 0 24px;">
    <a
      href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup"
      style="display: inline-block; border-radius: 8px; background: #67e8f9; color: #0f172a; font-weight: 700; padding: 12px 18px; text-decoration: none;"
    >
      Confirm your account
    </a>
  </p>
  <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">
    If the button does not work, copy and paste this link into your browser.
  </p>
  <p style="margin: 0; font-size: 14px; word-break: break-all;">
    <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup" style="color: #0369a1;">{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup</a>
  </p>
</div>
```

Do not use `&token_hash=...` immediately after `/auth/callback` in this
template. Without the `?`, the browser requests
`/auth/callback&token_hash=...`, which is not the real callback route.
