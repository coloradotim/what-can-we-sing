export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <a
          href="/"
          className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
        >
          What Can We Sing
        </a>

        <h1 className="mt-4 text-4xl font-bold tracking-tight">Privacy</h1>
        <p className="mt-3 text-lg text-slate-300">
          Here is the short version of what the app stores and why.
        </p>

        <section className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold">What is stored</h2>
            <p className="mt-2 text-slate-300">
              What Can We Sing stores your display name and your repertoire:
              song titles, parts you know, confidence level, and optional
              arranger names.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Where it is stored</h2>
            <p className="mt-2 text-slate-300">
              This information is stored in Supabase, the backend database used
              by the app.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Why it is stored</h2>
            <p className="mt-2 text-slate-300">
              The app uses your repertoire to help singers quickly find songs
              they can sing together in a quartet.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">What is not done</h2>
            <p className="mt-2 text-slate-300">
              We do not sell your data. We do not share it with third parties
              beyond the backend services needed to run the app.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
