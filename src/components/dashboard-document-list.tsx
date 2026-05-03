"use client";

import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import { DocumentReanalyzeButton } from "@/components/document-reanalyze-button";
import { formatAiRawJsonAsPlainGerman } from "@/lib/documents/ai-metadata-plain-de";
import { documentTypeUiLabel } from "@/lib/documents/categories";
import type { DashboardDocumentRow } from "@/lib/documents/dashboard-row";
import { addDaysToYmd, compareYmd, formatCurrency, formatDate, todayYmd } from "@/lib/documents/format";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import { documentStatusUiLabel } from "@/lib/documents/ui-labels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
      <span
        className="inline-flex select-none items-center gap-1.5 text-xs font-medium text-emerald-700"
        aria-label="Status: Erledigt"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        Erledigt
      </span>
    );
  }
  if (actionRequired) {
    return (
      <span className="inline-flex select-none items-center gap-1.5 text-xs font-medium text-amber-800">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
        Handlung nötig
      </span>
    );
  }
  return (
    <span className="inline-flex select-none items-center gap-1.5 text-xs font-medium text-zinc-500">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden />
      Offen
    </span>
  );
}

function DashboardExpandedAnalysis({ doc }: { doc: DashboardDocumentRow }) {
  const m = doc.document_metadata;
  const aiPlain =
    doc.raw_ai_json && typeof doc.raw_ai_json === "object" && !Array.isArray(doc.raw_ai_json)
      ? formatAiRawJsonAsPlainGerman(doc.raw_ai_json)
      : "";

  return (
    <div className="space-y-6 border-t border-zinc-100 bg-zinc-50/60 px-4 py-5 sm:px-5">
      {m ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800">Auswertung</h3>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-zinc-500">Dokumentart (KI)</dt>
              <dd className="mt-1 text-zinc-800">{documentTypeUiLabel(m.document_type)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Dokumentdatum</dt>
              <dd className="mt-1 text-zinc-800">{m.document_date ? formatDate(m.document_date) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Ablage</dt>
              <dd className="mt-1 text-zinc-800">{doc.workspace_bucket === "done" ? "Erledigt" : "Posteingang"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Kategorie</dt>
              <dd className="mt-1 text-zinc-800">{doc.category?.trim() || "—"}</dd>
            </div>
            {doc.payment_payer?.trim() ? (
              <div>
                <dt className="text-xs font-medium text-zinc-500">Zahlung von</dt>
                <dd className="mt-1 text-zinc-800">{doc.payment_payer}</dd>
              </div>
            ) : null}
            {doc.payment_recipient?.trim() ? (
              <div>
                <dt className="text-xs font-medium text-zinc-500">Zahlung an</dt>
                <dd className="mt-1 text-zinc-800">{doc.payment_recipient}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-zinc-800">Dokument</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          <a
            href={`/api/documents/${doc.id}/download`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
          >
            Herunterladen
          </a>
          <DocumentReanalyzeButton documentId={doc.id} userEditedAt={doc.user_edited_at} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Download-Link kurz gültig.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-800">Technische Angaben</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-zinc-500">Auswertung</dt>
            <dd className="mt-1 text-zinc-800">{documentStatusUiLabel(doc.status)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Originaldatei</dt>
            <dd className="mt-1 break-all text-zinc-800">{doc.original_filename}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Hochgeladen</dt>
            <dd className="mt-1 text-zinc-800">{new Date(doc.created_at).toLocaleString("de-DE")}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Zuletzt geändert</dt>
            <dd className="mt-1 text-zinc-800">{new Date(doc.updated_at).toLocaleString("de-DE")}</dd>
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
              <dd className="mt-1 text-zinc-800">{Math.round(Number(m.confidence) * 100)} %</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {doc.completion_note?.trim() ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-200/80">
          <p className="text-xs font-medium text-emerald-800">Notiz beim Erledigen</p>
          <p className="mt-1 whitespace-pre-wrap">{doc.completion_note.trim()}</p>
        </div>
      ) : null}

      {m?.action_required ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/80">
          <span className="font-semibold">Handlung nötig</span>
          {m.action_description ? ` — ${m.action_description}` : null}
        </div>
      ) : null}

      {m?.summary?.trim() ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Kurzüberblick</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">{m.summary.trim()}</p>
        </div>
      ) : null}

      {aiPlain ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Auswertung (KI, vollständig)</h3>
          <p className="mt-2 max-h-[min(28rem,70vh)] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-zinc-700 ring-1 ring-zinc-200/80">
            {aiPlain}
          </p>
        </div>
      ) : null}

      {!m && !aiPlain ? (
        <p className="text-sm text-zinc-500">Für dieses Dokument liegt noch keine Auswertung vor.</p>
      ) : null}
    </div>
  );
}

export function DashboardDocumentList({ documents }: { documents: DashboardDocumentRow[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sums = useMemo(() => sumByCurrency(documents), [documents]);

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
          const sender = m?.sender?.trim() || "";

          return (
            <li key={doc.id}>
              <article
                className={`cursor-pointer overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-100/80 transition hover:border-zinc-300 hover:shadow-md ${
                  idx % 2 === 1 ? "bg-zinc-50/40" : ""
                }`}
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("a, button, textarea, input, select, [role='dialog']")) return;
                  router.push(`/documents/${doc.id}`);
                }}
              >
                <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="block text-base font-semibold leading-snug text-zinc-900 line-clamp-2 hover:text-sky-900 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {title}
                    </Link>
                    <NotesPreview text={doc.completion_note} />
                    <p
                      className={`mt-2 text-sm ${sender ? "text-zinc-500" : "text-zinc-400"}`}
                      title={sender || undefined}
                    >
                      {sender || "Absender unbekannt"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-6 lg:items-end">
                    <div className="flex flex-row justify-between gap-10 sm:gap-14 lg:justify-end lg:gap-10 lg:text-right">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 lg:text-right">
                          Betrag
                        </p>
                        {amountStr ? (
                          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-zinc-900">
                            {amountStr}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm font-medium text-zinc-400">Kein Betrag</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 lg:text-right">
                          Frist
                        </p>
                        <p className={`mt-1 text-sm ${dueLabelClass(u)}`}>
                          {m?.due_date ? formatDate(m.due_date) : "Keine Frist"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-zinc-100/90 pt-6 lg:border-t-0 lg:pt-0">
                      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                        <StatusBadges workspace={doc.workspace_bucket} actionRequired={!!m?.action_required} />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
                        <Link
                          href={`/documents/${doc.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-h-[2.25rem] items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                        >
                          Ansehen
                        </Link>
                        <DashboardWorkspaceToggle documentId={doc.id} workspace={doc.workspace_bucket} />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId((id) => (id === doc.id ? null : doc.id));
                          }}
                          className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 transition hover:text-zinc-900 hover:decoration-zinc-500"
                        >
                          {expandedId === doc.id ? "Weniger anzeigen" : "Weitere Details"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {expandedId === doc.id ? <DashboardExpandedAnalysis doc={doc} /> : null}
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
