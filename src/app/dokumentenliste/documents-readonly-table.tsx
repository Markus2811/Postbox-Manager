"use client";

import type { EditableGridRow } from "@/app/dokumentenliste/editable-documents-table";
import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import { documentTypeUiLabel } from "@/lib/documents/categories";
import { formatCurrency, formatDate } from "@/lib/documents/format";
import Link from "next/link";
import type { ReactNode } from "react";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function Cell({
  children,
  title,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <td className={`max-w-[14rem] px-2 py-2 align-top text-xs text-zinc-800 ${className}`} title={title}>
      {children}
    </td>
  );
}

export function DocumentsReadonlyTable({ rows }: { rows: EditableGridRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-100/60">
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/95">
            <th className="sticky left-0 z-[1] whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Öffnen
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Ablage
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Datei
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Anzeigename
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Kategorie
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Bearbeitet
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Status
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Hochgeladen
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Dokumenttyp (KI)
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Belegdatum
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Frist
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Absender
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Zahlungsempf. (KI)
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Zahler (KI)
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Betrag
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Währung
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Aktion nötig
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Aktionsbeschreibung
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Kurzüberblick
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Notiz (Erledigt)
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Vertrauen
            </th>
            <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Dokument-ID
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const m = row.meta;
            const amt =
              m.amount?.trim() && !Number.isNaN(Number(m.amount.replace(",", ".")))
                ? formatCurrency(Number(m.amount.replace(",", ".")), m.currency || "EUR")
                : "—";
            const confPct =
              row.confidence != null && !Number.isNaN(Number(row.confidence))
                ? `${Math.round(Number(row.confidence) * 100)} %`
                : "—";
            const sum = m.summary?.trim() ?? "";
            const act = m.action_description?.trim() ?? "";
            const note = row.completion_note?.trim() ?? "";

            return (
              <tr
                key={row.id}
                className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50/90 ${
                  idx % 2 === 1 ? "bg-zinc-50/40" : "bg-white"
                }`}
              >
                <td
                  className={`sticky left-0 z-[1] whitespace-nowrap border-b border-zinc-100 px-2 py-2 align-top ${
                    idx % 2 === 1 ? "bg-zinc-50/40" : "bg-white"
                  }`}
                >
                  <Link
                    href={`/documents/${row.id}`}
                    className="font-medium text-sky-800 underline-offset-2 hover:underline"
                  >
                    Detail
                  </Link>
                </td>
                <Cell className="whitespace-nowrap">
                  <span className="block text-zinc-600">{row.workspace_label}</span>
                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                    <DashboardWorkspaceToggle documentId={row.id} workspace={row.workspace_bucket} />
                  </div>
                </Cell>
                <Cell title={row.original_filename}>
                  <span className="line-clamp-2">{truncate(row.original_filename, 80)}</span>
                </Cell>
                <Cell title={row.display_title}>
                  <span className="line-clamp-2 font-medium">{truncate(row.display_title, 80)}</span>
                </Cell>
                <Cell>{row.category?.trim() || "—"}</Cell>
                <Cell className="whitespace-nowrap text-zinc-600">
                  {row.user_edited_at ? formatDate(row.user_edited_at) : "—"}
                </Cell>
                <Cell className="whitespace-nowrap text-zinc-600">{row.status_label}</Cell>
                <Cell className="whitespace-nowrap text-zinc-600">{formatDate(row.created_at)}</Cell>
                <Cell className="whitespace-nowrap">
                  {m.document_type ? documentTypeUiLabel(m.document_type) : "—"}
                </Cell>
                <Cell className="whitespace-nowrap">
                  {m.document_date ? formatDate(m.document_date) : "—"}
                </Cell>
                <Cell className="whitespace-nowrap">{m.due_date ? formatDate(m.due_date) : "—"}</Cell>
                <Cell title={m.sender}>{truncate(m.sender || "—", 60)}</Cell>
                <Cell title={row.recipient}>{truncate(row.recipient || "—", 60)}</Cell>
                <Cell title={row.payer}>{truncate(row.payer || "—", 60)}</Cell>
                <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-2 text-right align-top text-xs font-medium tabular-nums text-zinc-900">
                  {amt}
                </td>
                <Cell className="whitespace-nowrap">{(m.currency || "EUR").toUpperCase()}</Cell>
                <Cell className="whitespace-nowrap">{m.action_required ? "Ja" : "Nein"}</Cell>
                <Cell title={act}>{truncate(act, 120) || "—"}</Cell>
                <Cell title={sum}>{truncate(sum, 160) || "—"}</Cell>
                <Cell title={note}>{truncate(note, 120) || "—"}</Cell>
                <Cell className="whitespace-nowrap">{confPct}</Cell>
                <Cell className="font-mono text-[11px] text-zinc-500">{row.id}</Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
