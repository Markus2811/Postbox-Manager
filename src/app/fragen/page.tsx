import { AppNav } from "@/components/app-nav";
import { FragenClient } from "@/app/fragen/fragen-client";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FragenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Fragen zu deinen Dokumenten
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Es werden bis zu mehrere hundert deiner Dokumente mit Metadaten (inkl. Erledigt-Notizen) an OpenAI
            geschickt. Bei Formulierungen wie <strong className="font-medium text-zinc-800">„nächste Woche“</strong>{" "}
            oder <strong className="font-medium text-zinc-800">„letzte 6 Monate“</strong> filtert das System vorab
            nach Frist bzw. Upload-Datum. Kein Ersatz für Rechts- oder Steuerberatung.
          </p>
        </div>
        <FragenClient />
        <p className="text-center text-sm">
          <Link href="/dashboard" className="text-zinc-600 underline-offset-2 hover:underline">
            Zum Dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
