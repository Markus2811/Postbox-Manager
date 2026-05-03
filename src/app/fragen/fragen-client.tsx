"use client";

import Link from "next/link";
import { useState } from "react";

export type AskSource = { id: string; title: string };

export function FragenClient() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<AskSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAnswer(null);
    setSources(null);
    setBusy(true);
    const res = await fetch("/api/documents/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      answer?: string;
      sources?: AskSource[];
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Anfrage fehlgeschlagen");
      return;
    }
    setAnswer(body.answer ?? "");
    setSources(Array.isArray(body.sources) ? body.sources : []);
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      <div>
        <label htmlFor="frage" className="block text-sm font-medium text-zinc-700">
          Deine Frage
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Es werden Metadaten und der gespeicherte Volltext aus der letzten Analyse genutzt. Sehr alte
          Dokumente ggf. einmal erneut analysieren, damit der Text für Detailfragen vorliegt.
        </p>
        <textarea
          id="frage"
          required
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder='z. B. „Habe ich in den letzten 6 Monaten etwas von der Versicherung XY?“ oder „Welche Fristen habe ich nächste Woche?“'
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Denkt nach …" : "Antwort holen"}
      </button>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {answer ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800 shadow-sm">
            {answer}
          </div>
          {sources && sources.length > 0 ? (
            <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-4 shadow-sm ring-1 ring-zinc-100/80">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Berücksichtigte Dokumente
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Für diese Antwort relevante Quellen aus deiner Bibliothek (vom Modell benannt bzw. bei Bedarf
                automatisch eingegrenzt). Zum Nachlesen im Original:
              </p>
              <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                {sources.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-800" title={s.title}>
                      {s.title}
                    </span>
                    <Link
                      href={`/documents/${s.id}`}
                      className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      Öffnen
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
