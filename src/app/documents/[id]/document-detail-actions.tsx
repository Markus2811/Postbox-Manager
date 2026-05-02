"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Nur KI-Analyse & Zusatztext – Download liegt in der Dokument-Sektion der Seite. */
export function DocumentAdvancedAnalysis({
  documentId,
  status,
}: {
  documentId: string;
  status: string;
}) {
  const router = useRouter();
  const [manualText, setManualText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function analyze() {
    setMessage(null);
    setBusy(true);
    const res = await fetch("/api/documents/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        manualText: manualText.trim() || undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Analyse fehlgeschlagen");
      return;
    }
    setMessage("Fertig – Seite wird aktualisiert.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Wenn die Datei wenig Text enthält, hier Inhalt einfügen und erneut auswerten lassen.
      </p>
      <label htmlFor="manual" className="block text-sm font-medium text-zinc-700">
        Zusätzlicher Text
      </label>
      <textarea
        id="manual"
        rows={4}
        value={manualText}
        onChange={(e) => setManualText(e.target.value)}
        placeholder="Optional: Auszug oder Abschrift …"
        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
      />

      <button
        type="button"
        onClick={() => void analyze()}
        disabled={busy}
        className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Auswertung läuft …" : "Erneut auswerten"}
      </button>

      {status === "processing" ? (
        <p className="text-sm text-amber-800">Auswertung läuft …</p>
      ) : null}
      {message ? (
        <p className="text-sm text-zinc-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
