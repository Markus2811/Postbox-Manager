"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const weiter = searchParams.get("weiter");
  const urlFehler = searchParams.get("fehler");
  const urlFehlerText = useMemo(() => {
    if (urlFehler === "bestaetigung") {
      return "Der Bestätigungslink ist abgelaufen oder ungültig. Bitte erneut registrieren oder Passwort zurücksetzen.";
    }
    return null;
  }, [urlFehler]);

  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [fehlerCode, setFehlerCode] = useState<string | null>(null);
  const [ladevorgang, setLadevorgang] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setFehlerCode(null);
    setLadevorgang(true);
    try {
      const apiUrl = new URL("/api/auth/login", window.location.origin).toString();
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: passwort }),
        credentials: "include",
        cache: "no-store",
      });
      const raw = await res.text();
      let json: { error?: string; code?: string | null; ok?: boolean };
      try {
        json = JSON.parse(raw) as { error?: string; code?: string | null; ok?: boolean };
      } catch {
        setFehler(
          `Unerwartete Antwort (${res.status}). Bitte Seite neu laden (Strg+F5) und Tunnel-URL prüfen.`
        );
        return;
      }
      if (!res.ok) {
        setFehler(typeof json.error === "string" ? json.error : "Anmeldung fehlgeschlagen.");
        setFehlerCode(typeof json.code === "string" && json.code ? json.code : null);
        return;
      }
      const ziel =
        weiter && weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/dashboard";
      // Voller Seitenwechsel: Session-Cookies aus der Login-API sicher anwenden (kein Client-Router-Zwischenstand).
      window.location.assign(ziel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFehler(
        msg.includes("fetch") || msg.includes("Failed to fetch")
          ? "Netzwerkfehler: Server nicht erreichbar oder Konfiguration prüfen."
          : msg
      );
    } finally {
      setLadevorgang(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Anmelden</h1>
      <p className="mt-1 text-sm text-zinc-500">Postbox Manager</p>
      <form onSubmit={absenden} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="passwort" className="block text-sm font-medium text-zinc-700">
            Passwort
          </label>
          <input
            id="passwort"
            name="passwort"
            type="password"
            autoComplete="current-password"
            required
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
          />
        </div>
        {urlFehlerText ? (
          <p className="text-sm text-amber-800" role="status">
            {urlFehlerText}
          </p>
        ) : null}
        {fehler ? (
          <div className="space-y-1" role="alert">
            <p className="text-sm text-red-600">{fehler}</p>
            {fehlerCode ? (
              <p className="text-xs text-zinc-500">Technischer Code: {fehlerCode}</p>
            ) : null}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={ladevorgang}
          className="rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {ladevorgang ? "Wird angemeldet …" : "Anmelden"}
        </button>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Ohne Bestätigungs-Mail kein Login: im Supabase-Dashboard{" "}
        <strong className="text-zinc-700">Authentication → Providers → Email</strong> die Option{" "}
        <strong className="text-zinc-700">Confirm email</strong> für Tests auschalten, oder Spam prüfen
        / SMTP einrichten.
      </p>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Noch kein Konto?{" "}
        <Link
          href="/signup"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline"
        >
          Registrieren
        </Link>
      </p>
    </div>
  );
}
