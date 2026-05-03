"use client";

import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import type { DashboardDocumentRow } from "@/lib/documents/dashboard-row";
import { addDaysToYmd, compareYmd, formatCurrency, formatDate, todayYmd } from "@/lib/documents/format";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

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

export function DashboardDocumentList({ documents }: { documents: DashboardDocumentRow[] }) {
  const router = useRouter();
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
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-6">
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
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link
                        href={`/documents/${doc.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
                      >
                        Ansehen
                      </Link>
                      <div className="[&_button]:min-h-[2.25rem]">
                        <DashboardWorkspaceToggle documentId={doc.id} workspace={doc.workspace_bucket} />
                      </div>
                    </div>
                  </div>
                </div>
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
