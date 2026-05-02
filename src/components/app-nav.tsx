import { AbmeldenButton } from "@/components/abmelden-button";
import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dokumentenliste", label: "Dokumente" },
  { href: "/upload", label: "Upload" },
  { href: "/fragen", label: "Fragen" },
  { href: "/analytics", label: "Analytics" },
] as const;

export function AppNav() {
  return (
    <header className="bg-white/90 shadow-sm shadow-zinc-900/5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/dashboard" className="shrink-0 text-base font-semibold tracking-tight text-zinc-900">
          Postbox
        </Link>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-medium text-zinc-600 transition hover:text-zinc-900"
            >
              {label}
            </Link>
          ))}
          <AbmeldenButton />
        </nav>
      </div>
    </header>
  );
}
