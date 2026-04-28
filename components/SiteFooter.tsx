const footerLinks = [
  { href: "/help", label: "Help & Feedback" },
  { href: "/privacy", label: "Privacy" },
  {
    href: "https://github.com/coloradotim/what-can-we-sing",
    label: "GitHub",
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 px-6 py-6 text-sm text-slate-500">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <span>&copy; 2026 What Can We Sing</span>
        {footerLinks.map((link) => (
          <span key={link.href} className="flex items-center gap-2">
            <span aria-hidden="true">·</span>
            <a
              href={link.href}
              className="font-semibold text-slate-400 hover:text-cyan-200"
            >
              {link.label}
            </a>
          </span>
        ))}
      </div>
    </footer>
  );
}
