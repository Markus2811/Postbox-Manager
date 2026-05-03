import { AppPageLayout } from "@/components/app-page-layout";
import { ViewEmpty, ViewSection } from "@/components/views/view-doc-card";
import { computeDocumentAnalytics } from "@/lib/documents/analytics";
import { formatCurrency, formatDate } from "@/lib/documents/format";
import { getDocumentsWithMetadata } from "@/lib/documents/queries";
import { paletteForCategory, paletteForDocumentTypeKey } from "@/lib/documents/ui-palette";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

const WEEK_LIST_MAX = 14;

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const docs = await getDocumentsWithMetadata(supabase, user.id);
  const a = computeDocumentAnalytics(docs);

  return (
    <AppPageLayout
      title="Analytics"
      description="Auszählungen und Kennzahlen aus deinen Dokumenten und KI-Metadaten – Fristen, Kalenderwoche, Typen und Kategorien mit Farbcodierung."
    >
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="underline-offset-2 hover:underline">
          ← Dashboard
        </Link>
      </p>

      <ViewSection title="Kurzüberblick">
        {a.total === 0 ? (
          <ViewEmpty message="Noch keine Dokumente zum Auswerten." />
        ) : (
          <ul className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">
            {a.insights.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-zinc-400">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </ViewSection>

      <ViewSection title="Kacheln">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Dokumente
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{a.total}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Handlung nötig
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{a.actionRequired}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-700">
              Überfällig
            </p>
            <p className="mt-1 text-2xl font-semibold text-rose-900">{a.overdueCount}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-800">
              Fristen diese Woche
            </p>
            <p className="mt-1 text-2xl font-semibold text-sky-950">{a.dueThisWeekCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Fristen ≤ 30 Tage
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {a.deadlinesNext30Days}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Ø Sicherheit (KI)
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {a.avgConfidencePercent != null ? `${a.avgConfidencePercent} %` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm xl:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Kalenderwoche
            </p>
            <p className="mt-1 text-xs font-medium leading-snug text-zinc-800">
              {a.calendarWeekLabel}
            </p>
          </div>
        </div>
      </ViewSection>

      <ViewSection title="Top 3 nächste Fristen / To-dos">
        {a.topDeadlineTodos.length === 0 ? (
          <ViewEmpty message="Keine Einträge mit Frist oder Handlungs-Hinweis in den Metadaten." />
        ) : (
          <ul className="space-y-3">
            {a.topDeadlineTodos.map((doc, idx) => {
              const m = doc.document_metadata;
              const cat = doc.category?.trim() || "Ohne Kategorie";
              const pal = paletteForCategory(cat);
              return (
                <li key={doc.id}>
                  <Link
                    href={`/dashboard?focus=${encodeURIComponent(doc.id)}`}
                    className="flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300"
                  >
                    <span
                      className={`w-1.5 shrink-0 self-stretch ${pal.bar}`}
                      aria-hidden
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900">
                          {doc.display_name ?? doc.original_filename}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${pal.soft} ${pal.text} ${pal.border}`}
                          >
                            {cat}
                          </span>
                          <span>{m?.document_type ?? "—"}</span>
                          {m?.action_required ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                              Handlung
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="font-semibold tabular-nums text-zinc-900">
                        {formatDate(m?.due_date ?? null)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatCurrency(m?.amount ?? null, m?.currency ?? null)}
                      </p>
                    </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ViewSection>

      <ViewSection title={`Diese Kalenderwoche (${a.calendarWeekLabel})`}>
        {a.thisWeekDeadlineDocs.length === 0 ? (
          <ViewEmpty message="In dieser Woche (Mo–So) sind keine Fälligkeitsdaten in den Metadaten gesetzt." />
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-600">
              {a.dueThisWeekCount} Dokument(e) mit Frist in dieser Woche – sortiert nach Datum.
            </p>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              {a.thisWeekDeadlineDocs.slice(0, WEEK_LIST_MAX).map((doc) => {
                const m = doc.document_metadata;
                const cat = doc.category?.trim() || "Ohne Kategorie";
                const pal = paletteForCategory(cat);
                return (
                  <li key={doc.id}>
                    <Link
                      href={`/dashboard?focus=${encodeURIComponent(doc.id)}`}
                      className="flex flex-col gap-1 px-4 py-3 transition hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-zinc-900">
                          {doc.display_name ?? doc.original_filename}
                        </span>
                        <span
                          className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${pal.soft} ${pal.text} ${pal.border}`}
                        >
                          {cat}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm tabular-nums text-zinc-600">
                        <span className="font-medium text-zinc-900">
                          {formatDate(m?.due_date ?? null)}
                        </span>
                        {m?.action_required ? (
                          <span className="text-xs text-amber-800">Handlung</span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {a.thisWeekDeadlineDocs.length > WEEK_LIST_MAX ? (
              <p className="mt-2 text-xs text-zinc-500">
                … und {a.thisWeekDeadlineDocs.length - WEEK_LIST_MAX} weitere – vollständige Liste unter{" "}
                <Link href="/fristen" className="underline-offset-2 hover:underline">
                  Fristen
                </Link>
                .
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                Alle Fristen:{" "}
                <Link href="/fristen" className="underline-offset-2 hover:underline">
                  Fristen-Übersicht
                </Link>
                .
              </p>
            )}
          </>
        )}
      </ViewSection>

      <ViewSection title="Nach Dokumenttyp (KI)">
        {a.byDocumentType.length === 0 ? (
          <ViewEmpty message="Keine Typen erkannt." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Typ</th>
                  <th className="px-4 py-2 text-right">Anzahl</th>
                  <th className="px-4 py-2 text-right">Anteil</th>
                  <th className="px-4 py-2 text-right">Mit Betrag</th>
                  <th className="px-4 py-2 text-right">Summe (EUR)*</th>
                  <th className="px-4 py-2 text-right">Handlung</th>
                  <th className="px-4 py-2 text-right">Ø Sicherh.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {a.byDocumentType.map((row) => {
                  const pal = paletteForDocumentTypeKey(row.typeKey);
                  return (
                    <tr key={row.typeKey}>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2 font-medium text-zinc-900">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${pal.bar}`} />
                          {row.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100 sm:block">
                            <div
                              className={`h-full rounded-full ${pal.bar}`}
                              style={{ width: `${Math.min(100, row.sharePercent)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-zinc-600">{row.sharePercent} %</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                        {row.withAmountCount}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {row.sumAmount > 0 ? formatCurrency(row.sumAmount, "EUR") : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                        {row.actionRequiredCount}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                        {row.avgConfidencePercent != null ? `${row.avgConfidencePercent} %` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
              * Summen werden wie in „Finanzen“ grob addiert (häufig EUR); andere Währungen
              werden nicht separat umgerechnet.
            </p>
          </div>
        )}
      </ViewSection>

      <ViewSection title="Nach Kategorie (App)">
        {a.byCategory.length === 0 ? (
          <ViewEmpty message="Keine Kategorien." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Kategorie</th>
                  <th className="px-4 py-2 text-right">Anzahl</th>
                  <th className="px-4 py-2 text-right">Anteil</th>
                  <th className="px-4 py-2 text-right">Summe (EUR)*</th>
                  <th className="px-4 py-2 text-right">Handlung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {a.byCategory.map((row) => {
                  const pal = paletteForCategory(row.category);
                  return (
                    <tr key={row.category}>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2 font-medium text-zinc-900">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${pal.bar}`} />
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${pal.soft} ${pal.text} ${pal.border}`}
                          >
                            {row.category}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100 sm:block">
                            <div
                              className={`h-full rounded-full ${pal.bar}`}
                              style={{ width: `${Math.min(100, row.sharePercent)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-zinc-600">{row.sharePercent} %</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {row.sumAmount > 0 ? formatCurrency(row.sumAmount, "EUR") : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                        {row.actionRequiredCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ViewSection>

      <ViewSection title="Nach Verarbeitungsstatus">
        {a.byStatus.length === 0 ? (
          <ViewEmpty message="Keine Daten." />
        ) : (
          <ul className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
            {a.byStatus.map((row) => {
              const pct = a.total > 0 ? Math.round((row.count / a.total) * 1000) / 10 : 0;
              return (
                <li key={row.status}>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-700">{row.status}</span>
                    <span className="tabular-nums text-zinc-600">
                      {row.count} ({pct} %)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-500"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ViewSection>
    </AppPageLayout>
  );
}
