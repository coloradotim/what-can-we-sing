# Supabase Auth SMTP with Resend

Supabase's built-in Auth email sender is useful for early development, but it
is rate-limited and should not be used for real user testing. Configure custom
SMTP in Supabase Auth with Resend so magic link emails are reliable.

Do not add SMTP credentials to this repository, frontend code, or Vercel
environment variables. The Resend API key belongs only in the Supabase
dashboard SMTP settings.

## 1. Create or open a Resend account

1. Go to [Resend](https://resend.com/).
2. Create an account or sign in.
3. Open **Domains**.

## 2. Verify a sending domain

Use a domain you control, for example `whatcanwesing.com`.

1. In Resend, go to **Domains**.
2. Add the sending domain.
3. Copy the DNS records Resend provides.
4. Add those DNS records wherever the domain's DNS is managed.
5. Wait for Resend to show the domain as verified.

For production deliverability, prefer an address on the verified domain such as
`login@whatcanwesing.com`. Avoid using a personal Gmail, iCloud, or Yahoo
address as the sender.

## 3. Create a Resend API key

1. In Resend, go to **API Keys**.
2. Create a key for Supabase Auth email.
3. Copy it once and keep it private.

## 4. Configure Supabase custom SMTP

1. Open the Supabase project.
2. Go to **Authentication**.
3. Go to **Emails** or **Email** under the Auth configuration area.
4. Open **SMTP Settings**.
5. Enable custom SMTP.
6. Enter:

```text
Sender name: What Can We Sing
Sender email: login@<your-verified-domain>
Host: smtp.resend.com
Port: 465
Username: resend
Password: <your Resend API key>
```

Use port `465` with SSL/SMTPS. Resend also supports other SMTP ports, but
`465` is the recommended default for this project.

Save the SMTP settings.

## 5. Confirm Supabase Auth URLs

In Supabase, go to **Authentication > URL Configuration**.

Set:

```text
Site URL: https://what-can-we-sing.vercel.app
```

Add redirect URLs:

```text
https://what-can-we-sing.vercel.app/*
http://localhost:3000/*
```

The production app sends magic links through `/auth/callback`, and these
wildcard redirect URLs allow both production and local callback paths.

## 6. Confirm email templates

Keep the project templates in
[auth-email-template.md](./auth-email-template.md). The Magic Link template
must preserve the app-generated `{{ .RedirectTo }}` and append:

```text
&token_hash={{ .TokenHash }}&type=email
```

## 7. Test the flow

Run the checklist in
[auth-manual-test-checklist.md](./auth-manual-test-checklist.md).

At minimum, verify:

1. A magic link email arrives promptly.
2. The sender shows as What Can We Sing from the verified sender address.
3. The button opens `/auth/callback`.
4. The user lands in the app and stays logged in after refresh.
5. The flow works on both desktop and mobile.

If delivery fails, check:

- The Resend domain is verified.
- The sender email matches the verified domain.
- The Supabase SMTP password is the Resend API key.
- Supabase Auth URL configuration includes the production callback URL.
