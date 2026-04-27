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

In Supabase Auth URL configuration, make sure the production URL and any local development URL, such as `http://localhost:3000`, are allowed redirect URLs.
