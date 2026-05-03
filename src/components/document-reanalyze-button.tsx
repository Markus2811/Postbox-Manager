"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  documentId: string;
  /** Wenn gesetzt: Hinweis, dass Titel/Kategorie nicht überschrieben werden */
  userEditedAt: string | null | undefined;
  /** Zusätzliche Klassen für den Haupt-Button (z. B. Layout). */
  className?: string;
};

const PROGRESS_CAP_LOADING = 97;

export function DocumentReanalyzeButton({ documentId, userEditedAt, className }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgress = useCallback(() => {
    if (progressIntervalRef.current != null) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearProgress();
    };
  }, [clearProgress]);

  const startProgress = useCallback(() => {
    clearProgress();
    setProgressPercent(1);
    progressIntervalRef.current = setInterval(() => {
      setProgressPercent((p) => {
        if (p == null) return null;
        if (p >= PROGRESS_CAP_LOADING) return p;
        const step = p < 50 ? 2 : 1;
        return Math.min(PROGRESS_CAP_LOADING, p + step);
      });
    }, 160);
  }, [clearProgress]);

  const onClick = useCallback(async () => {
    setPhase("loading");
    setMessage(null);
    startProgress();
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
      clearProgress();
      if (!res.ok) {
        setProgressPercent(null);
        setPhase("error");
        setMessage(data.error ?? "Analyse fehlgeschlagen.");
        return;
      }
      setProgressPercent(100);
      setPhase("success");
      setMessage(
        data.preservedDisplayAndCategory
          ? "Auswertung aktualisiert. Titel und Kategorie wurden wegen manueller Anpassung beibehalten."
          : "Auswertung erfolgreich aktualisiert."
      );
      router.refresh();
    } catch {
      clearProgress();
      setProgressPercent(null);
      setPhase("error");
      setMessage("Netzwerkfehler oder Server nicht erreichbar.");
    }
  }, [clearProgress, documentId, router, startProgress]);

  const busy = phase === "loading";
  const showBar =
    progressPercent != null && (phase === "loading" || phase === "success");

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
      >
        {busy ? (
          <>
            Analyse läuft…
            {progressPercent != null ? ` ${progressPercent}%` : ""}
          </>
        ) : (
          "Erneut analysieren"
        )}
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
      {showBar ? (
        <div className="w-full">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
            role="progressbar"
            aria-valuenow={progressPercent ?? 0}
            aria-valuemin={1}
            aria-valuemax={100}
            aria-label="Fortschritt erneute Analyse"
          >
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-200 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}
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
