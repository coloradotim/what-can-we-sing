import { AppNav } from "@/components/AppNav";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <AppNav />

        <h1 className="mt-8 text-4xl font-bold tracking-tight">Privacy</h1>
        <p className="mt-3 text-lg text-slate-300">
          What Can We Sing is built to help singers compare repertoire in the
          room. This page explains what information the app uses, what other
          quartet members can see, and which services help run the app.
        </p>

        <section className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold">Information we collect</h2>
            <p className="mt-2 text-slate-300">
              We store your email address so you can sign in and access your
              saved repertoire. We do not show your email address to other
              singers in a quartet.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
              <li>Your display name for profile and quartet screens.</li>
              <li>
                Your repertoire entries, including song title, voicing, parts
                known, confidence, arranger if entered, notes if entered, date
                added or updated, and recently sung information.
              </li>
              <li>
                Quartet/session data, including join codes, active membership,
                and participant repertoire snapshots used to calculate matches.
              </li>
              <li>
                Feedback messages you send, including the contact email shown in
                the form if you leave it there or edit it.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold">How we use it</h2>
            <p className="mt-2 text-slate-300">
              The app uses your information to sign you in, save your profile,
              manage your repertoire, let you join or leave quartets, refresh
              quartet snapshots, and show songs the group may be able to sing.
              Song title suggestions are generated from distinct song title,
              voicing, and arranger values that singers have entered before.
              Those suggestions do not include who entered the song, notes,
              parts, confidence, or other personal details.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              What quartet members can see
            </h2>
            <p className="mt-2 text-slate-300">
              When you join a quartet, other singers in that quartet may see
              your display name and repertoire-derived information needed for
              matching, such as songs, voicing, parts, confidence, and possible
              arrangement details or warnings. This sharing is the core purpose
              of the app: helping the quartet answer what can we sing together
              right now.
            </p>
            <p className="mt-2 text-slate-300">
              Personal repertoire notes are stored for you and are not included
              in participant snapshots. Notes may appear to you in your own
              repertoire and match details.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Feedback messages</h2>
            <p className="mt-2 text-slate-300">
              Feedback forms are sent through the app backend and email
              provider. Feedback emails can include your message, feedback type,
              contact email, user ID, display name, and the time submitted so we
              can understand and respond to the request.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Analytics</h2>
            <p className="mt-2 text-slate-300">
              If analytics are enabled, we use PostHog to understand product
              usage and reliability. Analytics events may include routes,
              counts, categories, browser/device information, and coarse action
              details. We do not intentionally send feedback text, repertoire
              notes, song titles, arranger names, singer names, email addresses,
              or quartet join codes to analytics.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Services we use</h2>
            <p className="mt-2 text-slate-300">
              What Can We Sing uses Supabase for authentication, database, and
              realtime features; Vercel for hosting and deployment; Resend for
              email delivery when configured; and PostHog for optional product
              analytics. These services may process technical information such
              as IP address, browser details, request logs, and delivery logs as
              part of operating the app.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">What we do not do</h2>
            <p className="mt-2 text-slate-300">
              We do not sell your data. We do not intentionally make your email
              address, private notes, or account information public. We share
              information with service providers only as needed to run,
              troubleshoot, and improve the app.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Deletion or help requests</h2>
            <p className="mt-2 text-slate-300">
              If you need help with your account, feedback you submitted, or a
              data deletion request, use the feedback form on the help page and
              include a contact email so we can follow up.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Changes to this page</h2>
            <p className="mt-2 text-slate-300">
              We may update this page as the app changes. The goal is to keep it
              accurate, readable, and aligned with how the app actually works.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
