"use client";

import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const navItems = [
  {
    href: "/",
    label: "Home",
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/session",
    label: "Start a quartet",
    isActive: (pathname: string) => pathname === "/session",
  },
  {
    href: "/#join-quartet",
    label: "Join a quartet",
    isActive: (pathname: string) => pathname.startsWith("/join"),
  },
  {
    href: "/repertoire",
    label: "Manage my rep",
    isActive: (pathname: string) => pathname === "/repertoire",
  },
  {
    href: "/settings",
    label: "Settings",
    isActive: (pathname: string) => pathname === "/settings",
  },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="rounded-2xl border border-white/10 bg-white/10 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {navItems.map((item) => {
          const active = item.isActive(pathname);
          const href =
            active && pathname.startsWith("/join") ? pathname : item.href;

          return (
            <a
              key={item.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                active
                  ? "bg-cyan-300 text-slate-950"
                  : "text-cyan-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </a>
          );
        })}

        <SignOutButton className="rounded-xl px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/10 hover:text-white disabled:opacity-50" />
      </div>
    </nav>
  );
}
