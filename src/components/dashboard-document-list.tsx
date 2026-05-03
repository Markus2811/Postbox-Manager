"use client";

import { DocumentReanalyzeButton } from "@/components/document-reanalyze-button";
import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import { formatAiRawJsonAsPlainGerman } from "@/lib/documents/ai-metadata-plain-de";
import type { DashboardDocumentRow } from "@/lib/documents/dashboard-row";
import { documentTypeUiLabel } from "@/lib/documents/categories";
import { addDaysToYmd, compareYmd, formatCurrency, formatDate, todayYmd } from "@/lib/documents/format";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import { documentStatusUiLabel } from "@/lib/documents/ui-labels";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

function dueLabelClass(u: ReturnType<typeof dueUrgency>): string {
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
      width="16"
      height="16"
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

function NotesPreview({ text }: { text: string | null }) {
  const t = text?.trim();
  if (!t) {
    return <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400">Keine Notiz</p>;
  }
  return (
    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-600" title={t}>
      {t}
    </p>
  );
}

function StatusBadges({
  workspace,
  actionRequired,
}: {
  workspace: DashboardDocumentRow["workspace_bucket"];
  actionRequired: boolean;
}) {
  const done = workspace === "done";
  if (done) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200/80">
        Erledigt
      </span>
    );
  }
  if (actionRequired) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200/80">
        Handlung nötig
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200/80">
      Offen
    </span>
  );
}

export function DashboardDocumentList({
  documents,
  initialExpandedDocumentId,
}: {
  documents: DashboardDocumentRow[];
  initialExpandedDocumentId?: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const id = initialExpandedDocumentId?.trim();
    if (id && documents.some((d) => d.id === id)) return { [id]: true };
    return {};
  });

  useEffect(() => {
    const id = initialExpandedDocumentId?.trim();
    if (!id || !documents.some((d) => d.id === id)) return;
    setExpanded((p) => ({ ...p, [id]: true }));
  }, [initialExpandedDocumentId, documents]);

  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  useEffect(() => {
    const id = initialExpandedDocumentId?.trim();
    if (!id || !documents.some((d) => d.id === id)) return;
    const t = window.setTimeout(() => {
      cardRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(t);
  }, [initialExpandedDocumentId, documents]);

  const sums = useMemo(() => sumByCurrency(documents), [documents]);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200/80">
        Keine Dokumente in dieser Ansicht.
        <div className="mt-4">
          <Link href="/upload" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
            Dokument hochladen
          </Link>
        </div>
      </div>
    );
  }

  const sumLabel =
    sums.length === 0 ? (
      <span className="text-sm font-medium text-zinc-400">Keine Beträge in der Ansicht</span>
    ) : (
      <span className="text-base font-semibold tabular-nums text-zinc-900">
        {sums.map((s) => formatCurrency(s.total, s.currency)).join(" · ")}
      </span>
    );

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {documents.map((doc, idx) => {
          const m = doc.document_metadata;
          const title = humanizeDocumentTitle(doc.display_name, doc.original_filename);
          const amount = parseDocAmount(doc);
          const amountStr = amount ? formatCurrency(amount.amount, amount.currency) : null;
          const u = dueUrgency(m?.due_date);
          const open = !!expanded[doc.id];
          const sender = m?.sender?.trim() || "";
          const amountOverview =
            m?.amount != null && !Number.isNaN(Number(m.amount))
              ? formatCurrency(Number(m.amount), m.currency ?? "EUR")
              : null;
          const aiPlainExtra =
            doc.raw_ai_json && Object.keys(doc.raw_ai_json).length > 0
              ? formatAiRawJsonAsPlainGerman(doc.raw_ai_json)
              : "";

          return (
            <li
              key={doc.id}
              ref={(el) => {
                if (el) cardRefs.current.set(doc.id, el);
                else cardRefs.current.delete(doc.id);
              }}
            >
              <article
                className={`cursor-pointer overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-100/80 transition hover:border-zinc-300 hover:shadow-md ${
                  idx % 2 === 1 ? "bg-zinc-50/40" : ""
                }`}
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (
                    t.closest(
                      "a, button, textarea, input, select, [role='dialog'], [data-no-row-toggle]"
                    )
                  ) {
                    return;
                  }
                  toggleExpand(doc.id);
                }}
              >
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-zinc-900 line-clamp-2">{title}</p>
                    <NotesPreview text={doc.completion_note} />
                    <p
                      className={`mt-2 text-sm ${sender ? "text-zinc-500" : "text-zinc-400"}`}
                      title={sender || undefined}
                    >
                      {sender || "Absender unbekannt"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-row gap-8 sm:gap-10 lg:flex-col lg:items-end lg:gap-3 lg:text-right">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 lg:text-right">
                        Betrag
                      </p>
                      {amountStr ? (
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">{amountStr}</p>
                      ) : (
                        <p className="mt-0.5 text-sm font-medium text-zinc-400">Kein Betrag</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 lg:text-right">
                        Frist
                      </p>
                      <p className={`mt-0.5 text-sm ${dueLabelClass(u)}`}>
                        {m?.due_date ? formatDate(m.due_date) : "Keine Frist"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 border-t border-zinc-100 pt-4 lg:border-t-0 lg:pt-0">
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <StatusBadges workspace={doc.workspace_bucket} actionRequired={!!m?.action_required} />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div className="[&_button]:min-h-[2.25rem]" data-no-row-toggle>
                        <DashboardWorkspaceToggle documentId={doc.id} workspace={doc.workspace_bucket} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleExpand(doc.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100/80 hover:text-zinc-900"
                    aria-expanded={open}
                  >
                    <Chevron open={open} />
                    {open ? "Weniger Details" : "Weitere Details"}
                  </button>
                </div>

                {open ? (
                  <div
                    className="border-t border-zinc-100 bg-white px-4 py-6 sm:px-6"
                    data-no-row-toggle
                    onClick={(e) => e.stopPropagation()}
                  >
                    <section className="space-y-3" aria-labelledby={`overview-${doc.id}`}>
                      <h2 id={`overview-${doc.id}`} className="text-base font-semibold text-zinc-900">
                        Übersicht
                      </h2>
                      <div className="rounded-2xl bg-zinc-50/80 p-5 ring-1 ring-zinc-200/60">
                        <dl className="grid gap-5 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">Ablage</dt>
                            <dd className="mt-1 text-sm font-semibold text-zinc-900">
                              {doc.workspace_bucket === "done" ? "Erledigt" : "Posteingang"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">Frist</dt>
                            <dd className="mt-1 text-sm font-semibold text-zinc-900">
                              {m?.due_date ? formatDate(m.due_date) : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">Betrag</dt>
                            <dd className="mt-1 text-sm font-semibold text-zinc-900">{amountOverview ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">Absender</dt>
                            <dd className="mt-1 text-sm text-zinc-800">{m?.sender?.trim() || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-zinc-500">Kategorie</dt>
                            <dd className="mt-1 text-sm text-zinc-800">{doc.category ?? "—"}</dd>
                          </div>
                          {doc.completion_note?.trim() ? (
                            <div className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-200/80">
                              <dt className="text-xs font-medium text-emerald-800">Notiz beim Erledigen</dt>
                              <dd className="mt-1 whitespace-pre-wrap">{doc.completion_note.trim()}</dd>
                            </div>
                          ) : null}
                          {m?.action_required ? (
                            <div className="sm:col-span-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/80">
                              <span className="font-semibold">Handlung nötig</span>
                              {m.action_description ? ` — ${m.action_description}` : null}
                            </div>
                          ) : null}
                          {m?.summary ? (
                            <div className="sm:col-span-2">
                              <dt className="text-xs font-medium text-zinc-500">Kurzüberblick</dt>
                              <dd className="mt-1 text-sm leading-relaxed text-zinc-700">{m.summary}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    </section>

                    <section className="mt-8 space-y-3" aria-labelledby={`file-${doc.id}`}>
                      <h2 id={`file-${doc.id}`} className="text-base font-semibold text-zinc-900">
                        Dokument
                      </h2>
                      <div className="rounded-2xl bg-zinc-50/80 p-5 ring-1 ring-zinc-200/60">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
                        >
                          Herunterladen
                        </a>
                        <p className="mt-3 text-xs text-zinc-500">Sicherer Link, kurz gültig.</p>
                        <DocumentReanalyzeButton documentId={doc.id} userEditedAt={doc.user_edited_at} />
                      </div>
                    </section>

                    <details className="group mt-8 rounded-2xl bg-zinc-50/50 ring-1 ring-zinc-200/60">
                      <summary className="cursor-pointer list-none px-5 py-4 text-base font-semibold text-zinc-900 marker:hidden [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-3">
                          Details
                          <span className="text-sm font-medium text-zinc-500 group-open:hidden">Anzeigen</span>
                          <span className="hidden text-sm font-medium text-zinc-500 group-open:inline">
                            Ausblenden
                          </span>
                        </span>
                      </summary>
                      <div className="space-y-6 border-t border-zinc-100 px-5 py-5">
                        {m ? (
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-zinc-800">Auswertung</h3>
                            <dl className="grid gap-4 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="text-xs font-medium text-zinc-500">Dokumentart (KI)</dt>
                                <dd className="mt-1 text-zinc-800">
                                  {documentTypeUiLabel(m.document_type)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs font-medium text-zinc-500">Dokumentdatum</dt>
                                <dd className="mt-1 text-zinc-800">
                                  {m.document_date ? formatDate(m.document_date) : "—"}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        ) : null}

                        <div>
                          <h3 className="text-sm font-semibold text-zinc-800">Technische Angaben</h3>
                          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="text-xs font-medium text-zinc-500">Auswertung</dt>
                              <dd className="mt-1 text-zinc-800">{documentStatusUiLabel(doc.status)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-zinc-500">Hochgeladen</dt>
                              <dd className="mt-1 text-zinc-800">
                                {new Date(doc.created_at).toLocaleString("de-DE")}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-zinc-500">Zuletzt geändert</dt>
                              <dd className="mt-1 text-zinc-800">
                                {new Date(doc.updated_at).toLocaleString("de-DE")}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-zinc-500">Dateityp</dt>
                              <dd className="mt-1 text-zinc-800">{doc.mime_type ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-zinc-500">Größe</dt>
                              <dd className="mt-1 text-zinc-800">
                                {doc.file_size != null ? `${(doc.file_size / 1024).toFixed(1)} KB` : "—"}
                              </dd>
                            </div>
                            {m?.confidence != null && !Number.isNaN(Number(m.confidence)) ? (
                              <div>
                                <dt className="text-xs font-medium text-zinc-500">Zuverlässigkeit (KI)</dt>
                                <dd className="mt-1 text-zinc-800">
                                  {Math.round(Number(m.confidence) * 100)} %
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>

                        {(doc.payment_payer || doc.payment_recipient) && (
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-800">Zahlung</h3>
                            <dl className="mt-2 space-y-2 text-sm">
                              {doc.payment_payer ? (
                                <div>
                                  <dt className="text-xs font-medium text-zinc-500">Zahler</dt>
                                  <dd className="text-zinc-800">{doc.payment_payer}</dd>
                                </div>
                              ) : null}
                              {doc.payment_recipient ? (
                                <div>
                                  <dt className="text-xs font-medium text-zinc-500">Empfänger</dt>
                                  <dd className="text-zinc-800">{doc.payment_recipient}</dd>
                                </div>
                              ) : null}
                            </dl>
                          </div>
                        )}

                        {aiPlainExtra ? (
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-800">Auswertung (Details)</h3>
                            <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-zinc-700 ring-1 ring-zinc-200/80">
                              {aiPlainExtra}
                            </p>
                          </div>
                        ) : null}

                        {!m ? (
                          <p className="text-sm text-zinc-500">Für dieses Dokument liegt noch keine Auswertung vor.</p>
                        ) : null}
                      </div>
                    </details>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>

      <div className="rounded-2xl border border-zinc-200/90 bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-100/80 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Summe Beträge (gefiltert)
          </span>
          {sumLabel}
        </div>
      </div>
    </div>
  );
}
