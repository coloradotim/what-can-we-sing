"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Application route error", error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="max-w-lg rounded-2xl border border-rose-300/20 bg-rose-400/10 p-6">
        <p className="text-sm font-semibold uppercase tracking-normal text-rose-100">
          Something went wrong
        </p>
        <h1 className="mt-2 text-3xl font-bold">The app hit a temporary issue.</h1>
        <p className="mt-3 text-slate-200">
          Reload this page and try again. If this is happening during a busy
          event, it may be a temporary service limit.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl bg-rose-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
