"use client";

import { supabaseDashboardUsersUrl } from "@/lib/supabase/public-host";
import Link from "next/link";
import { useState } from "react";

type SignupOkJson = {
  ok: true;
  session: boolean;
  userId?: string | null;
  supabaseHost?: string;
  dashboardUsersUrl?: string | null;
};

type SignupJson = SignupOkJson | { error: string; code?: string | null; supabaseHost?: string };

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladevorgang, setLadevorgang] = useState(false);
  const [erfolgDialog, setErfolgDialog] = useState<{
    open: boolean;
    mitSession: boolean;
    usersUrl: string;
  }>({
    open: false,
    mitSession: false,
    usersUrl: supabaseDashboardUsersUrl() ?? "https://supabase.com/dashboard",
  });

  function usersLinkFromResponse(data: SignupOkJson): string {
    if (typeof data.dashboardUsersUrl === "string" && data.dashboardUsersUrl) {
      return data.dashboardUsersUrl;
    }
    return supabaseDashboardUsersUrl() ?? "https://supabase.com/dashboard";
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setErfolgDialog((s) => ({ ...s, open: false }));
    setLadevorgang(true);
    try {
      const apiUrl = new URL("/api/auth/signup", window.location.origin).toString();
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          email: email.trim(),
          password: passwort,
          origin: window.location.origin,
        }),
      });

      const raw = await res.text();
      let data: SignupJson;
      try {
        data = JSON.parse(raw) as SignupJson;
      } catch {
        setFehler(
          `Unerwartete Antwort (${res.status}). Bitte Seite neu laden (Strg+F5) und Tunnel-URL prüfen. Anfang: ${raw.slice(0, 120).replace(/\s+/g, " ")}`
        );
        return;
      }

      if (!res.ok || !("ok" in data) || !data.ok) {
        let msg = "error" in data ? data.error : "Registrierung fehlgeschlagen.";
        if ("supabaseHost" in data && data.supabaseHost) {
          msg += ` (Supabase-Host: ${data.supabaseHost})`;
        }
        setFehler(msg);
        return;
      }

      const usersUrl = usersLinkFromResponse(data as SignupOkJson);
      setErfolgDialog({
        open: true,
        mitSession: Boolean(data.session),
        usersUrl,
      });

      if (data.session) {
        /* Dialog zuerst; „Zum Dashboard“ navigiert. */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFehler(
        msg.includes("fetch") || msg.includes("Failed to fetch")
          ? "Netzwerkfehler: Supabase nicht erreichbar oder falsche URL/Keys in .env.local prüfen."
          : msg
      );
    } finally {
      setLadevorgang(false);
    }
  }

  function dialogSchliessen() {
    setErfolgDialog((s) => ({ ...s, open: false }));
  }

  function zumDashboard() {
    window.location.assign("/dashboard");
  }

  function zumLogin() {
    window.location.assign("/login");
  }

  return (
    <>
      {erfolgDialog.open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) dialogSchliessen();
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registrierung-erfolg-titel"
          >
            <h2
              id="registrierung-erfolg-titel"
              className="text-lg font-semibold tracking-tight text-zinc-900"
            >
              Registrierung erfolgreich
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              {erfolgDialog.mitSession
                ? "Ihr Nutzerkonto wurde angelegt und Sie sind angemeldet. Sie können sich jederzeit wieder unter „Anmelden“ einloggen."
                : "Ihr Nutzerkonto wurde angelegt. Sie können sich nun anmelden (ggf. zuerst die Bestätigungs-Mail in Supabase nutzen)."}
            </p>
            <p className="mt-3 text-sm text-zinc-600">
              Nutzer in Supabase prüfen:{" "}
              <a
                href={erfolgDialog.usersUrl}
                className="font-medium text-zinc-900 underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Authentication → Users
              </a>
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={dialogSchliessen}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Schließen
              </button>
              {erfolgDialog.mitSession ? (
                <button
                  type="button"
                  onClick={zumDashboard}
                  className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Zum Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={zumLogin}
                  className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Zum Anmelden
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Registrieren</h1>
        <p className="mt-1 text-sm text-zinc-500">Privater Posteingang</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Kostenloses Nutzerkonto für Privatpersonen. Nach der Anmeldung sehen Sie nur Ihre eigenen
          Dokumente – dieselbe App-Instanz dient vielen Nutzern; die Trennung erfolgt über
          Row-Level-Security in der Datenbank.
        </p>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
            />
            <p className="mt-1 text-xs text-zinc-400">Mindestens 8 Zeichen.</p>
          </div>
          {fehler ? (
            <p className="text-sm text-red-600" role="alert">
              {fehler}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={ladevorgang}
            className="rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {ladevorgang ? "Wird erstellt …" : "Konto erstellen"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Schon ein Konto?{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline"
          >
            Anmelden
          </Link>
        </p>
      </div>
    </>
  );
}
