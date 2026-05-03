"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  documentId: string;
  /** Wenn gesetzt: Hinweis, dass Titel/Kategorie nicht überschrieben werden */
  userEditedAt: string | null | undefined;
};

export function DocumentReanalyzeButton({ documentId, userEditedAt }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setPhase("loading");
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        preservedDisplayAndCategory?: boolean;
      };
      if (!res.ok) {
        setPhase("error");
        setMessage(data.error ?? "Analyse fehlgeschlagen.");
        return;
      }
      setPhase("success");
      setMessage(
        data.preservedDisplayAndCategory
          ? "Auswertung aktualisiert. Titel und Kategorie wurden wegen manueller Anpassung beibehalten."
          : "Auswertung erfolgreich aktualisiert."
      );
      router.refresh();
    } catch {
      setPhase("error");
      setMessage("Netzwerkfehler oder Server nicht erreichbar.");
    }
  }, [documentId, router]);

  const busy = phase === "loading";

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Analyse läuft…" : "Erneut analysieren"}
      </button>
      <p className="text-xs text-zinc-500">
        Analysiert das Dokument erneut mit der aktuellen Logik.
        {userEditedAt ? (
          <span className="mt-1 block text-zinc-600">
            Manuelle Änderungen an Titel oder Kategorie bleiben erhalten; KI-Felder in der Auswertung
            werden erneuert.
          </span>
        ) : null}
      </p>
      {phase === "success" && message ? (
        <p className="text-sm font-medium text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {phase === "error" && message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
