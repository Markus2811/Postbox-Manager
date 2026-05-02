"use client";

import {
  downloadDocumentsCsvComma,
  downloadDocumentsCsvExcelDe,
} from "@/app/dokumentenliste/actions";
import { useTransition } from "react";

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DocumentsExportToolbar() {
  const [pending, startTransition] = useTransition();

  function run(kind: "comma" | "excelDe") {
    startTransition(async () => {
      try {
        const payload =
          kind === "comma"
            ? await downloadDocumentsCsvComma()
            : await downloadDocumentsCsvExcelDe();
        downloadBlob(payload.filename, payload.content);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Export fehlgeschlagen.";
        window.alert(msg);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("comma")}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "…" : "CSV herunterladen"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("excelDe")}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "…" : "Excel (CSV DE)"}
      </button>
      <span className="text-xs text-zinc-500">
        Export enthält alle Dokumente (nicht nur diese Seite).
      </span>
    </div>
  );
}
