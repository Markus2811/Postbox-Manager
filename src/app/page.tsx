import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-24">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Postbox Manager
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Physische Post digital verwalten
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          Lade PDFs und Fotos hoch, erkenne Fristen und behalte den Überblick. Kostenloses Konto
          für Privatpersonen – jede Anmeldung ist ein eigener Mandant; Daten sind technisch per
          Supabase-RLS voneinander getrennt.
        </p>
        <ul className="mt-4 list-inside list-disc text-left text-sm text-zinc-600">
          <li>Selbstregistrierung per E-Mail</li>
          <li>Keine Zahlungsanbindung im Produkt</li>
          <li>Betrieb als eine Instanz für viele Nutzer (Multi-Tenant)</li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Anmelden
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            Registrieren
          </Link>
        </div>
      </div>
    </div>
  );
}
