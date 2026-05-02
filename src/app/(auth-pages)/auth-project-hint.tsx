import { supabasePublicHost } from "@/lib/supabase/public-host";

export function AuthProjectHint() {
  const host = supabasePublicHost();
  if (!host) return null;
  return (
    <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
      Diese App sendet Auth-Anfragen an:{" "}
      <code className="break-all rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-800">
        {host}
      </code>
      <span className="mt-1 block">
        Muss exakt dem Host in deinem Supabase-Dashboard entsprechen (URL-Leiste: …/project/<strong>Ref</strong>/…).
      </span>
    </p>
  );
}
