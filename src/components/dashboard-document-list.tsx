"use client";

import type { DashboardDocumentRow } from "@/lib/documents/dashboard-row";
import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import { formatCurrency, formatDate } from "@/lib/documents/format";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import Link from "next/link";

export function DashboardDocumentList({ documents }: { documents: DashboardDocumentRow[] }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl bg-white px-6 py-12 text-center text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200/80">
        Keine Dokumente in dieser Ansicht.
        <div className="mt-4">
          <Link href="/upload" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
            Dokument hochladen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80">
      <table className="min-w-[56rem] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-3">Aktion</th>
            <th className="px-3 py-3">Titel</th>
            <th className="px-3 py-3">Frist</th>
            <th className="px-3 py-3">Betrag</th>
            <th className="px-3 py-3">Absender</th>
            <th className="px-3 py-3">Kategorie</th>
            <th className="px-3 py-3">Notizen</th>
            <th className="px-3 py-3">Ablage</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const m = doc.document_metadata;
            const title = humanizeDocumentTitle(doc.display_name, doc.original_filename);
            const amount =
              m?.amount != null && !Number.isNaN(Number(m.amount))
                ? formatCurrency(Number(m.amount), m.currency ?? "EUR")
                : "—";
            return (
              <tr key={doc.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="text-xs font-semibold text-zinc-900 underline-offset-2 hover:underline"
                  >
                    Ansehen
                  </Link>
                </td>
                <td className="max-w-[14rem] px-3 py-2.5">
                  <span className="font-medium text-zinc-900">{title}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-700">
                  {m?.due_date ? formatDate(m.due_date) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-700">{amount}</td>
                <td className="max-w-[10rem] truncate px-3 py-2.5 text-xs text-zinc-600" title={m?.sender ?? ""}>
                  {m?.sender?.trim() || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-zinc-600">{doc.category ?? "—"}</td>
                <td className="max-w-[12rem] px-3 py-2.5 text-xs text-zinc-600" title={doc.completion_note ?? ""}>
                  {doc.completion_note?.trim() ? (
                    <span className="line-clamp-2">{doc.completion_note}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <DashboardWorkspaceToggle documentId={doc.id} workspace={doc.workspace_bucket} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
