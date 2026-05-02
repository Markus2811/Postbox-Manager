/** Hostname aus NEXT_PUBLIC_SUPABASE_URL (nur Anzeige / Debugging, kein Geheimnis). */
export function supabasePublicHost(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) return "";
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

/** Link zur Users-Liste im Supabase-Dashboard (nur für `*.supabase.co`-Projekt-URLs). */
export function supabaseDashboardUsersUrl(): string | null {
  const host = supabasePublicHost();
  const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
  if (!m) return null;
  return `https://supabase.com/dashboard/project/${m[1]}/auth/users`;
}
