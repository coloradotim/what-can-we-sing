# Production Readiness

What Can We Sing can run on free-tier services for normal development and
small-group testing. Before a convention, Brigade weekend, or other high-usage
event, check the services below so quota or rate-limit failures do not surprise
singers in the room.

## Services To Monitor

- Vercel hosting, runtime errors, function limits, and deployment health
- Supabase Auth email/OTP rate limits
- Supabase database size, egress, PostgREST health, and paused-project status
- Supabase Realtime connection and message usage
- Resend daily/monthly email usage if it is in the login email path
- PostHog usage, ingestion status, and dashboard availability

## In-App Failure Handling

The app classifies common provider failures in `lib/runtimeErrors.ts` and shows
plain-language messages for email limits, database read failures, database
write/quota failures, rate limits, and network outages.

Expected user-facing behavior:

- Login email send failures mention temporary email limits or rate limits.
- My Songs and shared-song load failures do not pretend the user has no songs.
- Save failures explain that the app may be able to read data but unable to
  save changes because of a database usage limit or temporary service issue.
- Harmony Brigade batch adds report if some songs saved before a later failure.
- Quartet realtime failures show that live updates are paused and offer a
  manual refresh.
- Analytics calls are guarded so PostHog failures cannot block core flows.

## Event Preflight

Before a large event:

1. Check Supabase database size, egress, Auth email/rate limits, and Realtime
   usage.
2. Check Resend usage if email delivery is routed through Resend.
3. Check Vercel usage, recent runtime errors, and deployment health.
4. Consider temporarily upgrading Supabase, Resend, or Vercel for event week if
   expected use is close to a free-tier limit.
5. Do a smoke test: sign in, open My Songs, add a song, start a quartet, join
   from another device, and confirm live updates.
