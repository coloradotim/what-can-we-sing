# Supabase Auth Email Templates

This project does not include a checked-in Supabase `config.toml`, so the
hosted Supabase Auth email template must be configured in the Supabase
dashboard.

## One-Time Login Code

In Supabase, go to **Authentication > Email Templates > Magic Link** and use
this template. Even though Supabase labels the template "Magic Link", this app
uses the `{{ .Token }}` value as a one-time code and does not use the link URL.

Use the same subject and body for **Authentication > Email Templates > Confirm
signup** so first-time users also receive a code instead of a link.

Subject:

```text
Your What Can We Sing login code
```

Body:

```html
<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <h2 style="margin: 0 0 16px;">What Can We Sing</h2>
  <p style="margin: 0 0 16px;">
    Enter this code in What Can We Sing to log in:
  </p>
  <p
    style="display: inline-block; margin: 0 0 16px; border-radius: 8px; background: #ecfeff; color: #0f172a; font-size: 28px; font-weight: 700; letter-spacing: 4px; padding: 12px 18px;"
  >
    {{ .Token }}
  </p>
  <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">
    If you did not request this code, you can ignore this email.
  </p>
</div>
```

Do not include `{{ .ConfirmationURL }}`, `{{ .RedirectTo }}`, or
`{{ .TokenHash }}` in this template. The app verifies the typed code with
Supabase and no longer uses `/auth/callback` or magic-link redirects.
