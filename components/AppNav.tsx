"use client";

import { ActiveQuartetIndicator } from "@/components/ActiveQuartetIndicator";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const primaryNavItems = [
  {
    href: "/session",
    label: "Start",
    isActive: (pathname: string) => pathname === "/session",
  },
  {
    href: "/join",
    label: "Join",
    isActive: (pathname: string) => pathname.startsWith("/join"),
  },
  {
    href: "/songs",
    label: "My Songs",
    isActive: (pathname: string) =>
      pathname === "/songs" || pathname === "/repertoire",
  },
];

const secondaryNavItems = [
  {
    href: "/settings",
    label: "Profile",
    isActive: (pathname: string) => pathname === "/settings",
  },
  {
    href: "/help",
    label: "Help",
    isActive: (pathname: string) =>
      pathname === "/help" || pathname === "/feedback",
  },
];

type AppNavProps = {
  variant?: "app" | "public";
};

export function AppNav({ variant = "app" }: AppNavProps) {
  const pathname = usePathname();

  if (variant === "public") {
    return (
      <nav
        aria-label="Main navigation"
        className="rounded-2xl border border-white/10 bg-white/10 p-3"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="text-sm font-bold uppercase text-cyan-300">
            What Can We Sing
          </a>
          <a
            href="/login"
            className="rounded-xl bg-cyan-300 px-4 py-2 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Log in or sign up
          </a>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main navigation"
      className="rounded-2xl border border-white/10 bg-white/10 p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a href="/" className="text-sm font-bold uppercase text-cyan-300">
          What Can We Sing
        </a>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          {primaryNavItems.map((item) => {
            const active = item.isActive(pathname);

            return (
              <a
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
                  active
                    ? "bg-cyan-300 text-slate-950"
                    : "bg-white/5 text-cyan-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {secondaryNavItems.map((item) => {
          const active = item.isActive(pathname);

          return (
            <a
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`font-semibold ${
                active
                  ? "text-white"
                  : "text-slate-300 hover:text-cyan-200"
              }`}
            >
              {item.label}
            </a>
          );
        })}

        <SignOutButton className="font-semibold text-slate-300 hover:text-cyan-200 disabled:opacity-50" />
      </div>
      <ActiveQuartetIndicator />
    </nav>
  );
}
