# Magic Link Auth Manual Test Checklist

Run this checklist after changing Supabase Auth settings, auth email templates,
or the login/callback flow.

## Supabase dashboard setup

- Authentication > URL Configuration:
  - Site URL is the production app URL.
  - Redirect URLs include `https://your-production-app-url/auth/callback`.
  - Redirect URLs include `http://localhost:3000/auth/callback` for local tests.
- Authentication > Email Templates > Magic Link:
  - Button and fallback links use:
    `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
  - The template does not use `/login` as the link target.

## Local flow

1. Start the app locally.
2. Visit `/login`.
3. Request a magic link.
4. Open the link in the same browser.
5. Confirm the URL goes through `/auth/callback`.
6. Confirm the app lands on `/` by default.
7. Confirm refreshing `/` does not redirect back to `/login`.

## Protected route flow

1. In a signed-out browser, visit `/join/TEST12`.
2. Confirm the app redirects to `/login?redirect=/join/TEST12`.
3. Request and open a magic link.
4. Confirm the app lands back on `/join/TEST12`, not `/login`.

## Failure checks

- Opening `/auth/callback` without `code` or `token_hash` returns to `/login`.
- Opening a magic link twice should fail gracefully and not create a loop.
- If a profile has no display name, the app redirects to `/settings`, not
  `/login`.
