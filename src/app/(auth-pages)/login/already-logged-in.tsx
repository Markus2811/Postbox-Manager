import { AbmeldenButton } from "@/components/abmelden-button";
import Link from "next/link";

export function AlreadyLoggedIn({ email }: { email: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
      <p className="text-sm text-zinc-500">Du bist bereits angemeldet</p>
      <p className="mt-2 font-medium text-zinc-900">{email}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className="inline-flex justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Zum Dashboard
        </Link>
        <AbmeldenButton />
      </div>
    </div>
  );
}
