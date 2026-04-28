# OTP Auth Manual Test Checklist

Run this checklist after changing Supabase Auth settings, auth email templates,
or the login flow.

## Supabase Dashboard Setup

- Authentication > Email/Emails > SMTP Settings:
  - Custom SMTP is enabled.
  - Host is `smtp.resend.com`.
  - Port is `465`.
  - Username is `resend`.
  - Password is the Resend API key.
  - Sender name is `What Can We Sing`.
  - Sender email is on the verified Resend domain.
- Authentication > Email Templates > Magic Link:
  - The subject is `Your What Can We Sing login code`.
  - The body uses the one-time code template from
    [auth-email-template.md](./auth-email-template.md).
  - The body includes `{{ .Token }}`.
  - The body does not include `{{ .ConfirmationURL }}`, `{{ .RedirectTo }}`,
    `{{ .TokenHash }}`, or any `/auth/callback` link.
- Authentication > Email Templates > Confirm signup:
  - Use the same one-time code subject and body as the Magic Link template so
    first-time users receive a code instead of a link.

## Local Flow

1. Start the app locally.
2. Visit `/login`.
3. Enter an existing user email address and send a code.
4. Confirm the email contains a short login code, not a login link.
5. Enter the code in the app.
6. Confirm the app lands on `/` by default.
7. Confirm refreshing `/` does not redirect back to `/login`.

## New User Flow

1. Visit `/login` in a signed-out browser.
2. Enter a new email address and send a code.
3. Confirm the email contains a short login code, not a signup link.
4. Enter the code in the app.
5. Confirm the app lands on `/settings` if the new profile still needs a
   display name.

## Protected Route Flow

1. In a signed-out browser, visit `/join/TEST12`.
2. Confirm the app redirects to `/login?redirect=/join/TEST12`.
3. Enter an email address and send a code.
4. Enter the code in the app.
5. Confirm the app lands back on `/join/TEST12`, not `/login`.

## Failure Checks

- Entering an invalid code shows a clear error and stays on `/login`.
- Entering an expired code shows a clear error and lets the user request a new
  code.
- Opening `/auth/callback` while signed out redirects to `/login`; login no
  longer depends on that route.
- If a profile has no display name, the app redirects to `/settings`, not
  `/login`.
