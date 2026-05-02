"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function AbmeldenButton() {
  const [ladevorgang, setLadevorgang] = useState(false);

  async function abmelden() {
    setLadevorgang(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    window.location.assign("/");
  }

  return (
    <button
      type="button"
      onClick={abmelden}
      disabled={ladevorgang}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
    >
      {ladevorgang ? "…" : "Abmelden"}
    </button>
  );
}
