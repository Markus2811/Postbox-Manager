"use client";

import { sha256HexOfFile } from "@/lib/documents/file-hash";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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
  name: string;
  phase: "wartet" | "lädt" | "analysiert" | "fertig" | "fehler";
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

export function UploadClient() {
  const router = useRouter();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [drag, setDrag] = useState(false);
  const [zusatzText, setZusatzText] = useState("");

  const verarbeiteDateien = useCallback(
    async (files: FileList | File[]) => {
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
              nachricht: "Nur PDF, JPG oder PNG.",
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
              nachricht: "Dateityp nicht erlaubt.",
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
              nachricht: "Datei zu groß (max. 45 MB).",
            },
          ]);
          continue;
        }

        const rowId = crypto.randomUUID();
        setZeilen((z) => [...z, { id: rowId, name: file.name, phase: "lädt" }]);

        let contentHash: string;
        try {
          contentHash = await sha256HexOfFile(file);
        } catch {
          setZeilen((z) =>
            z.map((row) =>
              row.id === rowId
                ? { ...row, phase: "fehler", nachricht: "Prüfsumme der Datei konnte nicht berechnet werden." }
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
          setZeilen((z) =>
            z.map((row) =>
              row.id === rowId ? { ...row, phase: "fehler", nachricht: initRes.error } : row
            )
          );
          continue;
        }

        const init = initRes.data;
        if (init.duplicate === true) {
          setZeilen((z) =>
            z.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    phase: "fehler",
                    nachricht:
                      "Duplikat: Diese Datei (identischer Inhalt, SHA-256) liegt bereits vor – auch bei anderem Dateinamen.",
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
          z.map((row) => (row.id === rowId ? { ...row, id: docId, phase: "lädt" } : row))
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
          setZeilen((z) =>
            z.map((row) =>
              row.id === docId
                ? {
                    ...row,
                    phase: "fehler",
                    nachricht: upErr.message || "Upload zum Speicher fehlgeschlagen.",
                  }
                : row
            )
          );
          continue;
        }

        setZeilen((z) =>
          z.map((row) => (row.id === docId ? { ...row, phase: "analysiert" } : row))
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
          setZeilen((z) =>
            z.map((row) =>
              row.id === docId
                ? {
                    ...row,
                    phase: "fehler",
                    nachricht: analyzeBody.error ?? "Analyse fehlgeschlagen",
                  }
                : row
            )
          );
          continue;
        }

        setZeilen((z) =>
          z.map((row) => (row.id === docId ? { ...row, phase: "fertig" } : row))
        );
      }

      router.refresh();
    },
    [router, zusatzText]
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Dokument hochladen
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          PDF, JPEG oder PNG – Metadaten und Speicherpfad legt der Server an; die Datei wird direkt
          zu Supabase Storage übertragen. Danach startet die KI-Analyse. Gleiche Datei (Inhalt)
          erkennen wir auch bei anderem Dateinamen.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label htmlFor="zusatz" className="text-sm font-medium text-zinc-700">
          Optional: zusätzlicher Text für alle Uploads in dieser Sitzung (OCR / Notizen)
        </label>
        <textarea
          id="zusatz"
          value={zusatzText}
          onChange={(e) => setZusatzText(e.target.value)}
          rows={3}
          placeholder="Leer lassen, wenn die Datei ausreicht …"
          className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
        />
      </div>

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
        className={`rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
          drag
            ? "border-zinc-900 bg-zinc-50"
            : "border-zinc-200 bg-white hover:border-zinc-300"
        }`}
      >
        <p className="text-sm font-medium text-zinc-900">
          Dateien hierher ziehen
        </p>
        <p className="mt-1 text-xs text-zinc-500">oder</p>
        <label className="mt-4 inline-block cursor-pointer">
          <span className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Datei wählen
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

      {zeilen.length > 0 ? (
        <ul className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          {zeilen.map((z) => (
            <li
              key={z.id}
              className="flex flex-col gap-1 border-b border-zinc-100 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="truncate font-medium text-zinc-800">{z.name}</span>
              <span className="text-xs text-zinc-500">
                {z.phase === "wartet" && "Wartet …"}
                {z.phase === "lädt" && "Wird hochgeladen …"}
                {z.phase === "analysiert" && "KI-Analyse …"}
                {z.phase === "fertig" && "Fertig"}
                {z.phase === "fehler" && (
                  <span className="text-red-600">
                    {z.nachricht ?? "Fehler"}
                    {z.duplicateOfId ? (
                      <>
                        {" "}
                        <Link
                          href={`/documents/${z.duplicateOfId}`}
                          className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                        >
                          Zum bestehenden Eintrag
                        </Link>
                        {z.duplicateLabel ? (
                          <span className="block text-zinc-600">
                            ({z.duplicateLabel})
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-center text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline-offset-2 hover:underline">
          Zurück zum Dashboard
        </Link>
      </p>
    </div>
  );
}
