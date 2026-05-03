"use client";

import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import type { DashboardDocumentRow } from "@/lib/documents/dashboard-row";
import { addDaysToYmd, compareYmd, formatCurrency, formatDate, todayYmd } from "@/lib/documents/format";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

function EmptyCell() {
  return <span className="select-none text-[11px] text-zinc-200">·</span>;
}

function categoryGlyph(category: string | null | undefined): string | null {
  if (!category?.trim()) return null;
  const c = category.trim();
  if (c.includes("Rechnung")) return "€";
  if (c.includes("Vertrag")) return "◇";
  if (c.includes("Versicherung")) return "◆";
  if (c.includes("Bank") || c.includes("Finanz")) return "◎";
  if (c.includes("Steuer")) return "§";
  if (c.includes("Gesundheit")) return "+";
  if (c.includes("Behörde")) return "⌂";
  return "○";
}

function dueUrgency(due: string | null | undefined): "overdue" | "soon" | "neutral" | "empty" {
  if (!due?.trim()) return "empty";
  const d = due.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "empty";
  const t = todayYmd();
  if (compareYmd(d, t) < 0) return "overdue";
  const soonUntil = addDaysToYmd(t, 14);
  if (compareYmd(d, soonUntil) <= 0) return "soon";
  return "neutral";
}

function dueCellClass(u: ReturnType<typeof dueUrgency>): string {
  switch (u) {
    case "overdue":
      return "font-semibold text-red-600";
    case "soon":
      return "font-medium text-amber-700";
    case "neutral":
      return "text-zinc-700";
    default:
      return "text-zinc-400";
  }
}

function parseDocAmount(doc: DashboardDocumentRow): { amount: number; currency: string } | null {
  const m = doc.document_metadata;
  if (!m || m.amount == null) return null;
  const n = Number(m.amount);
  if (Number.isNaN(n)) return null;
  const cur = m.currency && m.currency.length === 3 ? m.currency : "EUR";
  return { amount: n, currency: cur };
}

function sumByCurrency(docs: DashboardDocumentRow[]): { currency: string; total: number }[] {
  const map = new Map<string, number>();
  for (const doc of docs) {
    const p = parseDocAmount(doc);
    if (!p) continue;
    map.set(p.currency, (map.get(p.currency) ?? 0) + p.amount);
  }
  return Array.from(map.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 text-zinc-500 opacity-70"
      aria-hidden
    >
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function DashboardDocumentList({ documents }: { documents: DashboardDocumentRow[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sums = useMemo(() => sumByCurrency(documents), [documents]);

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

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const sumLabel =
    sums.length === 0 ? (
      <EmptyCell />
    ) : (
      <span className="font-semibold tabular-nums text-zinc-900">
        {sums.map((s) => formatCurrency(s.total, s.currency)).join(" · ")}
      </span>
    );

  return (
    <div className="space-y-4">
      {/* Mobile: Karten */}
      <div className="space-y-3 md:hidden">
        {documents.map((doc, idx) => {
          const m = doc.document_metadata;
          const title = humanizeDocumentTitle(doc.display_name, doc.original_filename);
          const amount = parseDocAmount(doc);
          const amountStr = amount ? formatCurrency(amount.amount, amount.currency) : null;
          const u = dueUrgency(m?.due_date);
          const glyph = categoryGlyph(doc.category);
          const open = !!expanded[doc.id];
          return (
            <article
              key={doc.id}
              className={`rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm ${
                idx % 2 === 1 ? "bg-zinc-50/60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug text-zinc-900">{title}</p>
                  {m?.sender?.trim() ? (
                    <p className="mt-1 text-xs text-zinc-500">{m.sender.trim()}</p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-200">·</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleExpand(doc.id)}
                  className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100"
                  aria-expanded={open}
                  aria-label={open ? "Weniger anzeigen" : "Vollständigen Titel anzeigen"}
                >
                  <Chevron open={open} />
                </button>
              </div>
              {open ? (
                <p className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-2 text-xs leading-relaxed text-zinc-700">
                  {title}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-sm">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Frist</span>
                  <p className={`text-sm ${dueCellClass(u)}`}>
                    {m?.due_date ? formatDate(m.due_date) : <EmptyCell />}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Betrag</span>
                  <p className="font-semibold tabular-nums text-zinc-900">
                    {amountStr ?? <EmptyCell />}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                  {glyph ? <span className="text-sm opacity-80">{glyph}</span> : null}
                  <span>{doc.category?.trim() || <EmptyCell />}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <EyeIcon />
                    Ansehen
                  </Link>
                  <DashboardWorkspaceToggle documentId={doc.id} workspace={doc.workspace_bucket} />
                </div>
              </div>
            </article>
          );
        })}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Summe (gefiltert)</span>
            {sumLabel}
          </div>
        </div>
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200/90 bg-white shadow-sm md:block">
        <table className="w-full min-w-[64rem] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-[1] rounded-tl-xl border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Aktion
              </th>
              <th className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Titel
              </th>
              <th className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Frist
              </th>
              <th className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Betrag
              </th>
              <th className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Absender
              </th>
              <th className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Kategorie
              </th>
              <th className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Notizen
              </th>
              <th className="sticky top-0 z-[1] rounded-tr-xl border-b border-zinc-200 bg-zinc-50/95 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                Ablage
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, idx) => {
              const m = doc.document_metadata;
              const title = humanizeDocumentTitle(doc.display_name, doc.original_filename);
              const amount = parseDocAmount(doc);
              const amountStr = amount ? formatCurrency(amount.amount, amount.currency) : null;
              const u = dueUrgency(m?.due_date);
              const glyph = categoryGlyph(doc.category);
              const open = !!expanded[doc.id];
              const zebra = idx % 2 === 1 ? "bg-zinc-50/50" : "bg-white";
              return (
                <Fragment key={doc.id}>
                  <tr
                    className={`group border-b border-zinc-100/90 transition-colors last:border-0 ${zebra} hover:bg-zinc-100/70`}
                  >
                    <td className="align-top px-4 py-4">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1 text-xs font-medium text-zinc-600 underline-offset-2 hover:border-zinc-200 hover:bg-white hover:text-zinc-900 hover:underline"
                      >
                        <EyeIcon />
                        Ansehen
                      </Link>
                    </td>
                    <td className="max-w-[min(22rem,28vw)] align-top px-4 py-4">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(doc.id)}
                          className="mt-0.5 rounded-md p-0.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
                          aria-expanded={open}
                          title={open ? "Einklappen" : "Vollständigen Titel anzeigen"}
                        >
                          <Chevron open={open} />
                        </button>
                        <div className="min-w-0 flex-1" title={open ? undefined : title}>
                          <p
                            className={`font-semibold leading-snug text-zinc-900 ${
                              open ? "" : "line-clamp-2"
                            }`}
                          >
                            {title}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-4 align-top text-sm ${dueCellClass(u)}`}>
                      {m?.due_date ? formatDate(m.due_date) : <EmptyCell />}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right align-top text-sm font-semibold tabular-nums text-zinc-900">
                      {amountStr ?? <EmptyCell />}
                    </td>
                    <td className="max-w-[14rem] px-4 py-4 align-top">
                      <p
                        className="line-clamp-2 text-xs leading-relaxed text-zinc-500"
                        title={m?.sender?.trim() || undefined}
                      >
                        {m?.sender?.trim() || <EmptyCell />}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top text-xs text-zinc-600">
                      <span className="inline-flex items-center gap-1.5">
                        {glyph ? <span className="text-sm opacity-75">{glyph}</span> : null}
                        <span>{doc.category?.trim() || <EmptyCell />}</span>
                      </span>
                    </td>
                    <td className="max-w-[12rem] px-4 py-4 align-top text-xs text-zinc-600">
                      {doc.completion_note?.trim() ? (
                        <span className="line-clamp-2" title={doc.completion_note}>
                          {doc.completion_note}
                        </span>
                      ) : (
                        <EmptyCell />
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <DashboardWorkspaceToggle documentId={doc.id} workspace={doc.workspace_bucket} />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50/95">
              <td colSpan={3} className="rounded-bl-xl px-4 py-3.5 text-right text-xs font-medium text-zinc-500">
                Summe (gefiltert)
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">{sumLabel}</td>
              <td colSpan={4} className="rounded-br-xl px-4 py-3.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
