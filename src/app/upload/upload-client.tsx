"use client";

import { sha256HexOfFile } from "@/lib/documents/file-hash";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 45 * 1024 * 1024;

function extensionFor(file: File): "pdf" | "jpg" | "png" | null {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  return null;
}

function mimeFor(file: File, ext: "pdf" | "jpg" | "png"): string {
  const t = file.type;
  if (t && ALLOWED.has(t)) return t;
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

type Zeile = {
  id: string;
  /** Stabil pro Upload-Zeile (für Timer), bleibt erhalten wenn `id` → documentId wechselt */
  timerKey?: string;
  name: string;
  phase: "wartet" | "lädt" | "analysiert" | "fertig" | "fehler";
  progressPercent?: number;
  nachricht?: string;
  duplicateOfId?: string;
  duplicateLabel?: string;
};

type UploadInitDuplicate = {
  duplicate: true;
  existingId: string;
  existingLabel: string;
};

type UploadInitReady = {
  duplicate: false;
  documentId: string;
  path: string;
  token: string;
  contentType: string;
};

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof data.error === "string" ? data.error : "Anfrage fehlgeschlagen.",
    };
  }
  return { ok: true, data: data as T };
}

function IconUploadCloud({ className }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnalysisStepRow({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-400"
        }`}
        aria-hidden
      >
        {done ? "✓" : "…"}
      </span>
      <span className={done ? "font-medium text-zinc-800" : "text-zinc-500"}>{label}</span>
    </div>
  );
}

function UploadProgressCard({ z }: { z: Zeile }) {
  const p = z.progressPercent ?? 0;
  const showAnalysisSteps = z.phase === "analysiert" || z.phase === "fertig";
  const allStepsDone = z.phase === "fertig";

  return (
    <li
      key={z.timerKey ?? z.id}
      className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm ring-1 ring-black/[0.03]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 truncate font-medium text-zinc-900" title={z.name}>
          {z.name}
        </p>
        {z.phase === "fehler" ? (
          <span className="shrink-0 text-sm text-red-600">
            {z.nachricht ?? "Etwas ist schiefgelaufen."}
            {z.duplicateOfId ? (
              <>
                {" "}
                <Link
                  href={`/documents/${z.duplicateOfId}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  Zum vorhandenen Dokument
                </Link>
                {z.duplicateLabel ? (
                  <span className="mt-1 block text-xs text-zinc-600">({z.duplicateLabel})</span>
                ) : null}
              </>
            ) : null}
          </span>
        ) : z.phase === "fertig" ? (
          <span className="shrink-0 text-sm font-medium text-emerald-700">Fertig</span>
        ) : (
          <span className="shrink-0 text-sm text-zinc-600">
            {z.phase === "lädt" ? "Wird hochgeladen …" : "Dokument wird analysiert …"}
          </span>
        )}
      </div>

      {z.phase !== "fehler" && (z.phase === "lädt" || z.phase === "analysiert" || z.phase === "fertig") && z.progressPercent != null ? (
        <div className="mt-4 space-y-4">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
            role="progressbar"
            aria-valuenow={z.progressPercent}
            aria-valuemin={1}
            aria-valuemax={100}
            aria-label="Fortschritt"
          >
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-200 ease-out"
              style={{ width: `${z.progressPercent}%` }}
            />
          </div>

          {showAnalysisSteps ? (
            <div className="rounded-xl bg-zinc-50/90 px-4 py-3 ring-1 ring-zinc-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {allStepsDone ? "Auswertung abgeschlossen" : "Auswertung läuft"}
              </p>
              <div className="mt-3 space-y-2">
                <AnalysisStepRow label="Absender erkannt" done={allStepsDone || p >= 48} />
                <AnalysisStepRow label="Betrag erkannt" done={allStepsDone || p >= 65} />
                <AnalysisStepRow label="Frist erkannt" done={allStepsDone || p >= 82} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function UploadClient() {
  const router = useRouter();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [drag, setDrag] = useState(false);
  const [zusatzText, setZusatzText] = useState("");
  const [zusatzOpen, setZusatzOpen] = useState(false);
  const progressTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const progressCapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return () => {
      progressTimersRef.current.forEach((t) => clearInterval(t));
      progressTimersRef.current.clear();
      progressCapRef.current.clear();
    };
  }, []);

  const verarbeiteDateien = useCallback(
    async (files: FileList | File[]) => {
      const clearRowProgress = (timerKey: string) => {
        const t = progressTimersRef.current.get(timerKey);
        if (t) {
          clearInterval(t);
          progressTimersRef.current.delete(timerKey);
        }
        progressCapRef.current.delete(timerKey);
      };

      const startRowProgress = (timerKey: string) => {
        clearRowProgress(timerKey);
        progressCapRef.current.set(timerKey, 38);
        const id = setInterval(() => {
          const cap = progressCapRef.current.get(timerKey) ?? 97;
          setZeilen((z) =>
            z.map((row) => {
              if (row.timerKey !== timerKey) return row;
              const p = row.progressPercent ?? 1;
              if (p >= cap) return row;
              const step = p < 50 ? 2 : 1;
              return { ...row, progressPercent: Math.min(cap, p + step) };
            })
          );
        }, 160);
        progressTimersRef.current.set(timerKey, id);
      };

      const liste = Array.from(files);
      for (const file of liste) {
        const ext = extensionFor(file);
        if (!ext) {
          setZeilen((z) => [
            ...z,
            {
              id: crypto.randomUUID(),
              name: file.name,
              phase: "fehler",
              nachricht: "Bitte nur PDF, JPG oder PNG verwenden.",
            },
          ]);
          continue;
        }
        const mime = mimeFor(file, ext);
        if (!ALLOWED.has(mime)) {
          setZeilen((z) => [
            ...z,
            {
              id: crypto.randomUUID(),
              name: file.name,
              phase: "fehler",
              nachricht: "Dieser Dateityp wird nicht unterstützt.",
            },
          ]);
          continue;
        }
        if (file.size > MAX_BYTES) {
          setZeilen((z) => [
            ...z,
            {
              id: crypto.randomUUID(),
              name: file.name,
              phase: "fehler",
              nachricht: "Die Datei ist zu groß (max. 45 MB).",
            },
          ]);
          continue;
        }

        const rowId = crypto.randomUUID();
        const timerKey = rowId;
        setZeilen((z) => [
          ...z,
          {
            id: rowId,
            timerKey,
            name: file.name,
            phase: "lädt",
            progressPercent: 1,
          },
        ]);
        startRowProgress(timerKey);

        let contentHash: string;
        try {
          contentHash = await sha256HexOfFile(file);
        } catch {
          clearRowProgress(timerKey);
          setZeilen((z) =>
            z.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    phase: "fehler",
                    progressPercent: undefined,
                    nachricht: "Die Datei konnte nicht gelesen werden.",
                  }
                : row
            )
          );
          continue;
        }

        const initRes = await postJson<UploadInitDuplicate | UploadInitReady>("/api/documents/upload-init", {
          contentHash,
          originalFilename: file.name,
          mimeType: mime,
          fileSize: file.size,
          extension: ext,
        });

        if (!initRes.ok) {
          clearRowProgress(timerKey);
          setZeilen((z) =>
            z.map((row) =>
              row.id === rowId
                ? { ...row, phase: "fehler", progressPercent: undefined, nachricht: initRes.error }
                : row
            )
          );
          continue;
        }

        const init = initRes.data;
        if (init.duplicate === true) {
          clearRowProgress(timerKey);
          setZeilen((z) =>
            z.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    phase: "fehler",
                    progressPercent: undefined,
                    nachricht:
                      "Diese Datei liegt bereits in deiner Postbox (gleicher Inhalt) – auch bei anderem Dateinamen.",
                    duplicateOfId: init.existingId,
                    duplicateLabel: init.existingLabel,
                  }
                : row
            )
          );
          continue;
        }

        const ready = init as UploadInitReady;
        const docId = ready.documentId;
        setZeilen((z) =>
          z.map((row) => (row.id === rowId ? { ...row, id: docId, phase: "lädt", timerKey } : row))
        );

        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("documents")
          .uploadToSignedUrl(ready.path, ready.token, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: ready.contentType,
          });

        if (upErr) {
          await postJson("/api/documents/upload-abort", { documentId: docId });
          clearRowProgress(timerKey);
          setZeilen((z) =>
            z.map((row) =>
              row.id === docId
                ? {
                    ...row,
                    phase: "fehler",
                    progressPercent: undefined,
                    nachricht: "Upload ist fehlgeschlagen. Bitte erneut versuchen.",
                  }
                : row
            )
          );
          continue;
        }

        progressCapRef.current.set(timerKey, 97);
        setZeilen((z) =>
          z.map((row) =>
            row.id === docId
              ? {
                  ...row,
                  phase: "analysiert",
                  progressPercent: Math.max(row.progressPercent ?? 1, 42),
                }
              : row
          )
        );

        const manual = zusatzText.trim();
        const res = await fetch("/api/documents/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            documentId: docId,
            ...(manual ? { manualText: manual } : {}),
          }),
        });

        const analyzeBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!res.ok) {
          clearRowProgress(timerKey);
          setZeilen((z) =>
            z.map((row) =>
              row.id === docId
                ? {
                    ...row,
                    phase: "fehler",
                    progressPercent: undefined,
                    nachricht: analyzeBody.error ?? "Die Auswertung ist fehlgeschlagen.",
                  }
                : row
            )
          );
          continue;
        }

        clearRowProgress(timerKey);
        setZeilen((z) =>
          z.map((row) => (row.id === docId ? { ...row, phase: "fertig", progressPercent: 100 } : row))
        );
      }

      router.refresh();
    },
    [router, zusatzText]
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col px-4 py-12 sm:px-6 sm:py-16">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[1.65rem]">
          Dokument hochladen &amp; automatisch analysieren
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
          Wir lesen dein Dokument automatisch aus und fassen das Wichtigste zusammen –{" "}
          <span className="font-medium text-zinc-800">ohne manuelle Arbeit</span>.
        </p>
        <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-zinc-700">
          <li className="flex gap-2">
            <span className="text-emerald-600" aria-hidden>
              •
            </span>
            <span>Absender</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-600" aria-hidden>
              •
            </span>
            <span>Betrag</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-600" aria-hidden>
              •
            </span>
            <span>Fristen</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-600" aria-hidden>
              •
            </span>
            <span>Wichtige Infos auf einen Blick</span>
          </li>
        </ul>
        <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-zinc-500">
          PDF, JPG oder PNG · gleiche Datei erkennen wir auch bei anderem Namen
        </p>
      </header>

      <div className="mt-12">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.length) {
              void verarbeiteDateien(e.dataTransfer.files);
            }
          }}
          className={`group flex cursor-default flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition ${
            drag
              ? "border-zinc-900 bg-zinc-100/80 shadow-inner"
              : "border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-100/80 hover:border-zinc-400 hover:bg-zinc-50/50 hover:shadow-md"
          }`}
        >
          <IconUploadCloud
            className={`mb-5 transition-colors ${drag ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"}`}
          />
          <p className="text-base font-semibold text-zinc-900">Dokument hier ablegen</p>
          <p className="mt-2 text-sm text-zinc-500">oder</p>
          <label className="mt-6 cursor-pointer">
            <span className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800">
              Datei auswählen
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="sr-only"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) {
                  void verarbeiteDateien(e.target.files);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-10">
        <button
          type="button"
          onClick={() => setZusatzOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200/90 bg-white py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          aria-expanded={zusatzOpen}
        >
          <span className="text-zinc-500" aria-hidden>
            {zusatzOpen ? "−" : "+"}
          </span>
          Zusatzinfos hinzufügen (optional)
        </button>
        {zusatzOpen ? (
          <div className="mt-3 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-black/[0.03]">
            <label htmlFor="zusatz" className="text-sm font-medium text-zinc-800">
              Freitext für diese Uploads
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Nur nötig, wenn du der Auswertung noch Kontext geben möchtest. Leer lassen, wenn die Datei
              reicht.
            </p>
            <textarea
              id="zusatz"
              value={zusatzText}
              onChange={(e) => setZusatzText(e.target.value)}
              rows={3}
              placeholder="z. B. kurze Notiz zum Vorgang …"
              className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none ring-zinc-900 focus:ring-2"
            />
          </div>
        ) : null}
      </div>

      {zeilen.length > 0 ? (
        <ul className="mt-12 space-y-4">
          {zeilen.map((z) => (
            <UploadProgressCard key={z.timerKey ?? z.id} z={z} />
          ))}
        </ul>
      ) : null}

      <p className="mt-12 text-center text-xs text-zinc-500">Deine Dokumente werden sicher gespeichert.</p>

      <p className="mt-8 text-center text-sm">
        <Link href="/dashboard" className="font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline">
          Zum Dashboard
        </Link>
      </p>
    </main>
  );
}
