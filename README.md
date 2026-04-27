# what-can-we-sing
An app to allow a pick-up barbershop quartet to quickly find songs they can sing together

## Environment variables

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your Supabase anon key
NEXT_PUBLIC_SITE_URL=https://your-production-app-url
```

`NEXT_PUBLIC_SITE_URL` is used for Supabase magic-link redirects in production. Set it to the deployed Vercel app URL, without a trailing path. If it is blank during local development, login links fall back to the current localhost origin.

In Supabase Auth URL configuration, add the production URL and any required local development URL, such as `http://localhost:3000`, to the allowed redirect URLs.

## Supabase auth email

Hosted Supabase projects configure Auth email templates in the Supabase dashboard, not in this repo. Use the recommended Magic Link template in [docs/auth-email-template.md](docs/auth-email-template.md) so login emails are clearly branded as What Can We Sing and include a button plus fallback link.
