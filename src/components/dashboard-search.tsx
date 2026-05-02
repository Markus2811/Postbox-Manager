"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function DashboardSearch({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);

  function absenden(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    const trimmed = q.trim();
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    const qs = next.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  }

  return (
    <form onSubmit={absenden} className="flex w-full max-w-md gap-2">
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suche (Name, Absender, Text …)"
        className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Suchen
      </button>
    </form>
  );
}
