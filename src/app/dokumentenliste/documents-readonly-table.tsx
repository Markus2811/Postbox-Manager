"use client";

import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import type { EditableGridRow } from "@/app/dokumentenliste/editable-documents-table";
import { documentTypeUiLabel } from "@/lib/documents/categories";
import {
  addDaysToYmd,
  compareYmd,
  formatCurrency,
  formatDate,
  todayYmd,
} from "@/lib/documents/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

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

function dueClass(u: ReturnType<typeof dueUrgency>): string {
  switch (u) {
    case "overdue":
      return "font-semibold text-red-600";
    case "soon":
      return "font-semibold text-amber-700";
    case "neutral":
      return "font-semibold text-zinc-800";
    default:
      return "text-sm font-medium text-zinc-400";
  }
}

function parseRowAmount(row: EditableGridRow): { amount: number; currency: string } | null {
  const raw = row.meta.amount?.replace(/\s/g, "").replace(",", ".") ?? "";
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  const cur = row.meta.currency?.trim().length === 3 ? row.meta.currency.trim() : "EUR";
  return { amount: n, currency: cur };
}

function statusKind(row: EditableGridRow): "erledigt" | "faellig" | "keine" {
  if (row.workspace_bucket === "done") return "erledigt";
  const due = row.meta.due_date?.trim();
  const overdue =
    due &&
    /^\d{4}-\d{2}-\d{2}$/.test(due.slice(0, 10)) &&
    compareYmd(due.slice(0, 10), todayYmd()) < 0;
  if (overdue || row.meta.action_required) return "faellig";
  return "keine";
}

function StatusBadge({ row }: { row: EditableGridRow }) {
  const k = statusKind(row);
  if (k === "erledigt") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200/70">
        Erledigt
      </span>
    );
  }
  if (k === "faellig") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200/70">
        Fällig
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200/80">
      Keine Aktion
    </span>
  );
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

export function DocumentsReadonlyTable({ rows }: { rows: EditableGridRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-100/60">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/90">
            <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5 lg:w-[34%]">
              Dokument
            </th>
            <th className="hidden px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell sm:px-4 lg:w-[24%]">
              Notizen
            </th>
            <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-4 lg:w-[14%]">
              Betrag
            </th>
            <th className="hidden px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell sm:px-4 lg:w-[12%]">
              Frist
            </th>
            <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5 lg:w-[16%]">
              Status / Aktion
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = !!expanded[row.id];
            const amt = parseRowAmount(row);
            const amountStr = amt ? formatCurrency(amt.amount, amt.currency) : null;
            const u = dueUrgency(row.meta.due_date);
            const sender = row.meta.sender?.trim() || "";
            const note = row.completion_note?.trim() || "";

            return (
              <Fragment key={row.id}>
                <tr
                  className="group cursor-pointer border-b border-zinc-100/90 transition-colors last:border-b-0 hover:bg-zinc-50/90"
                  onClick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest("a, button, textarea, input, select, [role='dialog']")) return;
                    router.push(`/dashboard?focus=${encodeURIComponent(row.id)}`);
                  }}
                >
                  <td className="px-4 py-4 align-top sm:px-5">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(row.id);
                        }}
                        className="mt-0.5 rounded-md p-0.5 text-zinc-400 hover:bg-zinc-200/50 hover:text-zinc-700"
                        aria-expanded={open}
                        aria-label={open ? "Details einklappen" : "Details ausklappen"}
                      >
                        <Chevron open={open} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-semibold leading-snug text-zinc-900">{row.display_title}</p>
                        <p
                          className={`mt-1 line-clamp-1 text-xs ${sender ? "text-zinc-500" : "text-zinc-400"}`}
                          title={sender || undefined}
                        >
                          {sender || "Absender unbekannt"}
                        </p>
                        <div className="mt-2 sm:hidden">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Notizen</p>
                          {note ? (
                            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600" title={note}>
                              {note}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-zinc-400">Keine Notiz</p>
                          )}
                        </div>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 md:hidden">
                          Frist
                        </p>
                        <p className={`text-sm md:hidden ${dueClass(u)}`}>
                          {row.meta.due_date ? formatDate(row.meta.due_date) : "Keine Frist"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden align-top px-3 py-4 sm:table-cell sm:px-4">
                    {note ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-zinc-600" title={note}>
                        {note}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400">Keine Notiz</p>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right align-top tabular-nums sm:px-4">
                    {amountStr ? (
                      <span className="font-semibold text-zinc-900">{amountStr}</span>
                    ) : (
                      <span className="text-sm font-medium text-zinc-400">—</span>
                    )}
                  </td>
                  <td className={`hidden align-top px-3 py-4 text-sm md:table-cell sm:px-4 ${dueClass(u)}`}>
                    {row.meta.due_date ? formatDate(row.meta.due_date) : (
                      <span className="font-medium text-zinc-400">Keine Frist</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right align-top sm:px-5">
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge row={row} />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/dashboard?focus=${encodeURIComponent(row.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
                        >
                          Ansehen
                        </Link>
                        <div
                          className="[&_button]:text-xs [&_button]:shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DashboardWorkspaceToggle documentId={row.id} workspace={row.workspace_bucket} />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
                {open ? (
                  <tr className="border-b border-zinc-100/90 bg-zinc-50/70 last:border-b-0">
                    <td colSpan={5} className="px-4 py-4 sm:px-6">
                      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">Kategorie</dt>
                          <dd className="mt-0.5 text-zinc-800">{row.category?.trim() || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">Belegdatum</dt>
                          <dd className="mt-0.5 text-zinc-800">
                            {row.meta.document_date ? formatDate(row.meta.document_date) : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">Hochgeladen</dt>
                          <dd className="mt-0.5 text-zinc-800">
                            {new Date(row.created_at).toLocaleString("de-DE")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">Auswertung</dt>
                          <dd className="mt-0.5 text-zinc-800">{row.status_label}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">Dokumentart (KI)</dt>
                          <dd className="mt-0.5 text-zinc-800">
                            {documentTypeUiLabel(row.meta.document_type || null)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-zinc-500">Ablage</dt>
                          <dd className="mt-0.5 text-zinc-800">{row.workspace_label}</dd>
                        </div>
                        {(row.recipient || row.payer) && (
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-medium text-zinc-500">Zahlung</dt>
                            <dd className="mt-0.5 space-y-1 text-zinc-800">
                              {row.payer ? (
                                <p>
                                  <span className="text-zinc-500">Zahler: </span>
                                  {row.payer}
                                </p>
                              ) : null}
                              {row.recipient ? (
                                <p>
                                  <span className="text-zinc-500">Empfänger: </span>
                                  {row.recipient}
                                </p>
                              ) : null}
                            </dd>
                          </div>
                        )}
                        {row.meta.action_description?.trim() ? (
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-medium text-zinc-500">Aktionshinweis</dt>
                            <dd className="mt-0.5 text-zinc-800">{row.meta.action_description.trim()}</dd>
                          </div>
                        ) : null}
                        {row.meta.summary?.trim() ? (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <dt className="text-xs font-medium text-zinc-500">Kurzüberblick</dt>
                            <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed text-zinc-700">
                              {row.meta.summary.trim()}
                            </dd>
                          </div>
                        ) : null}
                        {note ? (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <dt className="text-xs font-medium text-zinc-500">Notiz (vollständig)</dt>
                            <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed text-zinc-700">{note}</dd>
                          </div>
                        ) : null}
                        <div className="sm:col-span-2 lg:col-span-3">
                          <dt className="text-xs font-medium text-zinc-500">Dateiname</dt>
                          <dd className="mt-0.5 truncate text-zinc-600" title={row.original_filename}>
                            {row.original_filename}
                          </dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
