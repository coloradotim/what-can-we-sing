# Supabase Magic Link Email Template

This project does not include a checked-in Supabase `config.toml`, so the hosted Supabase Auth email template must be configured in the Supabase dashboard.

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
      href="{{ .ConfirmationURL }}"
      style="display: inline-block; border-radius: 8px; background: #67e8f9; color: #0f172a; font-weight: 700; padding: 12px 18px; text-decoration: none;"
    >
      Log in to What Can We Sing
    </a>
  </p>
  <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">
    If the button does not work, copy and paste this link into your browser.
  </p>
  <p style="margin: 0; font-size: 14px; word-break: break-all;">
    <a href="{{ .ConfirmationURL }}" style="color: #0369a1;">{{ .ConfirmationURL }}</a>
  </p>
</div>
```

Supabase provides `{{ .ConfirmationURL }}` for the one-time login URL. Keep that variable in both links.
