"use client";

import { useState } from "react";

export function FragenClient() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAnswer(null);
    setBusy(true);
    const res = await fetch("/api/documents/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      answer?: string;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Anfrage fehlgeschlagen");
      return;
    }
    setAnswer(body.answer ?? "");
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      <div>
        <label htmlFor="frage" className="block text-sm font-medium text-zinc-700">
          Deine Frage
        </label>
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
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800 shadow-sm">
          {answer}
        </div>
      ) : null}
    </form>
  );
}
