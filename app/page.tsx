import { AppNav } from "@/components/AppNav";

const actions = [
  {
    href: "/session",
    title: "Start a quartet",
    description: "Create a code for others to join.",
  },
  {
    href: "/join",
    title: "Join a quartet",
    description: "Enter a code from another singer.",
  },
  {
    href: "/repertoire",
    title: "My repertoire",
    description: "Add or update songs you know.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <AppNav />

        <p className="mt-8 text-sm font-semibold uppercase text-cyan-300">
          What Can We Sing
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Find songs your quartet can sing now.
        </h1>
        <p className="mt-4 text-slate-300">
          Start a quartet, join with a code, or update the songs you know.
        </p>

        <div className="mt-10 space-y-3">
          {actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="block rounded-xl border border-white/10 bg-white/10 px-5 py-4 hover:border-cyan-300/60 hover:bg-white/15"
            >
              <span className="block text-lg font-semibold text-white">
                {action.title}
              </span>
              <span className="mt-1 block text-sm text-slate-300">
                {action.description}
              </span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
