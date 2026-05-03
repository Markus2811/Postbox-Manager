import type { CategoryBreakdown, DocumentAnalytics, DocumentTypeBreakdown } from "@/lib/documents/analytics";
import { addDaysToYmd, compareYmd, formatCurrency, formatDate, todayYmd } from "@/lib/documents/format";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import type { DocumentWithMetadata } from "@/lib/documents/types";
import { documentStatusUiLabel } from "@/lib/documents/ui-labels";
import { paletteForCategory, paletteForDocumentTypeKey } from "@/lib/documents/ui-palette";
import Link from "next/link";
import type { ReactNode } from "react";

const WEEK_PREVIEW_MAX = 5;

function sliceDueYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function dueAccent(
  ymd: string | null,
  weekStart: string,
  weekEnd: string
): { labelClass: string; sub: string | null } {
  if (!ymd) return { labelClass: "text-zinc-500", sub: null };
  const t = todayYmd();
  if (compareYmd(ymd, t) < 0) {
    return { labelClass: "font-semibold text-red-600", sub: "Überfällig" };
  }
  if (compareYmd(ymd, weekStart) >= 0 && compareYmd(ymd, weekEnd) <= 0) {
    return { labelClass: "font-semibold text-amber-700", sub: "Diese Woche" };
  }
  const soonUntil = addDaysToYmd(t, 7);
  if (compareYmd(ymd, soonUntil) <= 0) {
    return { labelClass: "font-semibold text-amber-600", sub: "Bald fällig" };
  }
  return { labelClass: "font-semibold text-zinc-900", sub: null };
}

function IconDocs({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "amber" | "red" | "orange" | "ok";
}) {
  const shell =
    tone === "red"
      ? "border-red-200/90 bg-red-50/50 shadow-red-900/5"
      : tone === "amber"
        ? "border-amber-200/90 bg-amber-50/40 shadow-amber-900/5"
        : tone === "orange"
          ? "border-orange-200/90 bg-orange-50/45 shadow-orange-900/5"
          : tone === "ok"
            ? "border-emerald-200/80 bg-emerald-50/35 shadow-emerald-900/5"
            : "border-zinc-200/80 bg-white shadow-zinc-900/5";

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 shadow-sm ring-1 ring-black/[0.03] ${shell}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        {icon ? <span className="text-zinc-400">{icon}</span> : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function SubtleAlerts({ a }: { a: DocumentAnalytics }) {
  const chips: { key: string; text: string; className: string }[] = [];
  if (a.processingCount > 0) {
    chips.push({
      key: "proc",
      text: `${a.processingCount} wird ausgewertet`,
      className: "bg-sky-50 text-sky-900 ring-sky-200/80",
    });
  }
  if (a.failedCount > 0) {
    chips.push({
      key: "fail",
      text: `${a.failedCount} Analyse fehlgeschlagen`,
      className: "bg-red-50 text-red-900 ring-red-200/80",
    });
  }
  if (a.withoutMetadata > 0) {
    chips.push({
      key: "meta",
      text: `${a.withoutMetadata} ohne Auswertung`,
      className: "bg-zinc-100 text-zinc-800 ring-zinc-200/80",
    });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span
          key={c.key}
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${c.className}`}
        >
          {c.text}
        </span>
      ))}
    </div>
  );
}

function DistributionBlock({
  title,
  hint,
  rows,
  renderRow,
}: {
  title: string;
  hint?: string;
  rows: { key: string }[];
  renderRow: (row: { key: string }, idx: number) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-6 py-12 text-center text-sm text-zinc-500 shadow-sm">
        Noch keine Daten für „{title}“.
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-zinc-500">{hint}</p> : null}
      </div>
      <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm ring-1 ring-black/[0.03] sm:p-6">
        {rows.map((row, idx) => renderRow(row, idx))}
      </div>
    </section>
  );
}

function TypeDistributionRow({ row, maxShare }: { row: DocumentTypeBreakdown; maxShare: number }) {
  const pal = paletteForDocumentTypeKey(row.typeKey);
  const w = maxShare > 0 ? Math.min(100, (row.sharePercent / maxShare) * 100) : 0;
  const sumNote =
    row.sumAmount > 0 ? ` · ${formatCurrency(row.sumAmount, "EUR")}` : "";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="flex min-w-0 items-center gap-2 font-medium text-zinc-900">
          <span className={`h-2 w-2 shrink-0 rounded-full ${pal.bar}`} />
          <span className="truncate">{row.label}</span>
        </span>
        <span className="shrink-0 tabular-nums text-zinc-600">
          <span className="font-semibold text-zinc-900">{row.count}</span>
          <span className="text-zinc-400"> · </span>
          {Math.round(row.sharePercent)}%{sumNote}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full transition-all ${pal.bar}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function CategoryDistributionRow({ row, maxShare }: { row: CategoryBreakdown; maxShare: number }) {
  const pal = paletteForCategory(row.category);
  const w = maxShare > 0 ? Math.min(100, (row.sharePercent / maxShare) * 100) : 0;
  const sumNote =
    row.sumAmount > 0 ? ` · ${formatCurrency(row.sumAmount, "EUR")}` : "";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span
          className={`inline-flex max-w-[70%] items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-medium ${pal.soft} ${pal.text} ${pal.border}`}
        >
          {row.category}
        </span>
        <span className="shrink-0 tabular-nums text-zinc-600">
          <span className="font-semibold text-zinc-900">{row.count}</span>
          <span className="text-zinc-400"> · </span>
          {Math.round(row.sharePercent)}%{sumNote}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${pal.bar}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function TopTodoCard({
  doc,
  rank,
  weekStart,
  weekEnd,
}: {
  doc: DocumentWithMetadata;
  rank: number;
  weekStart: string;
  weekEnd: string;
}) {
  const m = doc.document_metadata;
  const cat = doc.category?.trim() || "Ohne Kategorie";
  const pal = paletteForCategory(cat);
  const title = humanizeDocumentTitle(doc.display_name, doc.original_filename);
  const due = sliceDueYmd(m?.due_date ?? null);
  const { labelClass, sub } = dueAccent(due, weekStart, weekEnd);
  const amt =
    m?.amount != null && !Number.isNaN(Number(m.amount))
      ? formatCurrency(Number(m.amount), m.currency ?? "EUR")
      : null;

  return (
    <li>
      <Link
        href={`/documents/${doc.id}`}
        className="group flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm ring-1 ring-black/[0.03] transition hover:border-zinc-300 hover:shadow-md sm:flex-row sm:items-stretch sm:justify-between sm:gap-6"
      >
        <div className="flex min-w-0 flex-1 gap-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white"
            aria-hidden
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs font-medium ${pal.soft} ${pal.text} ${pal.border}`}
              >
                {cat}
              </span>
              {m?.action_required ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
                  Handlung nötig
                </span>
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-zinc-900 group-hover:text-sky-900">
              {title}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-row gap-8 border-t border-zinc-100 pt-4 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0 sm:text-right">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Frist</p>
            <p className={`mt-0.5 text-sm ${labelClass}`}>
              {due ? formatDate(due) : "—"}
            </p>
            {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Betrag</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900">
              {amt ?? "—"}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function AnalyticsDashboard({ data: a }: { data: DocumentAnalytics }) {
  const topType = a.byDocumentType[0];
  const topCat = a.byCategory[0];
  const maxTypeShare = Math.max(0, ...a.byDocumentType.map((r) => r.sharePercent));
  const maxCatShare = Math.max(0, ...a.byCategory.map((r) => r.sharePercent));

  const allUnderControl =
    a.total > 0 &&
    a.overdueCount === 0 &&
    a.actionRequired === 0 &&
    a.failedCount === 0;

  if (a.total === 0) {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-zinc-200/80 bg-white px-8 py-16 text-center shadow-sm ring-1 ring-black/[0.03]">
          <p className="text-lg font-medium text-zinc-900">Noch keine Dokumente</p>
          <p className="mt-2 text-sm text-zinc-500">
            Sobald du Dateien hochlädst, erscheinen hier Kennzahlen und To-dos.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
          >
            Zum Upload
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="font-medium text-zinc-700 underline-offset-2 hover:underline">
          ← Dashboard
        </Link>
      </p>

      <section aria-label="Kennzahlen" className="space-y-4">
        <h2 className="sr-only">Kennzahlen</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Dokumente"
            value={a.total}
            icon={<IconDocs className="text-zinc-400" />}
            tone="neutral"
          />
          <KpiCard
            label="Handlung nötig"
            value={a.actionRequired}
            icon={<IconAlert className={a.actionRequired > 0 ? "text-amber-600" : "text-zinc-400"} />}
            tone={a.actionRequired > 0 ? "amber" : "neutral"}
          />
          <KpiCard
            label="Überfällig"
            value={a.overdueCount}
            icon={<IconCalendar className={a.overdueCount > 0 ? "text-red-600" : "text-zinc-400"} />}
            tone={a.overdueCount > 0 ? "red" : "ok"}
          />
          <KpiCard
            label="Fristen ≤ 30 Tage"
            value={a.deadlinesNext30Days}
            icon={<IconCalendar className="text-orange-600" />}
            tone={a.deadlinesNext30Days > 0 ? "orange" : "neutral"}
          />
          <KpiCard
            label="Ø KI-Sicherheit"
            value={a.avgConfidencePercent != null ? `${a.avgConfidencePercent} %` : "—"}
            icon={<IconShield className="text-zinc-400" />}
            tone="neutral"
          />
        </div>
      </section>

      {allUnderControl ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-100">
          <span className="text-lg" aria-hidden>
            ✓
          </span>
          <span>
            <strong className="font-semibold">Alles im Blick</strong>
            <span className="text-emerald-900/90"> — keine überfälligen Fristen und keine offenen Handlungen.</span>
          </span>
        </div>
      ) : null}

      <SubtleAlerts a={a} />

      {(topType || topCat) && (
        <p className="text-sm text-zinc-600">
          {topType ? (
            <>
              <span className="font-medium text-zinc-800">Top-Typ:</span> {topType.label}{" "}
              <span className="tabular-nums text-zinc-500">({Math.round(topType.sharePercent)}%)</span>
            </>
          ) : null}
          {topType && topCat ? <span className="mx-2 text-zinc-300">·</span> : null}
          {topCat ? (
            <>
              <span className="font-medium text-zinc-800">Top-Kategorie:</span> {topCat.category}{" "}
              <span className="tabular-nums text-zinc-500">({Math.round(topCat.sharePercent)}%)</span>
            </>
          ) : null}
        </p>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Top To-dos</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Nächste Fristen und Dokumente mit Handlungsbedarf.
          </p>
        </div>
        {a.topDeadlineTodos.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-white px-6 py-10 text-center text-sm text-zinc-500 shadow-sm ring-1 ring-black/[0.03]">
            Keine Frist oder Handlung in den Metadaten — du bist hier durch.
          </div>
        ) : (
          <ul className="space-y-3">
            {a.topDeadlineTodos.map((doc, idx) => (
              <TopTodoCard
                key={doc.id}
                doc={doc}
                rank={idx + 1}
                weekStart={a.calendarWeekStart}
                weekEnd={a.calendarWeekEnd}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Diese Kalenderwoche</h2>
        <div
          className={`rounded-2xl border p-6 shadow-sm ring-1 ring-black/[0.03] ${
            a.dueThisWeekCount === 0
              ? "border-emerald-200/80 bg-emerald-50/30"
              : "border-amber-200/80 bg-amber-50/25"
          }`}
        >
          {a.dueThisWeekCount === 0 ? (
            <p className="text-base font-medium text-emerald-950">
              Keine Fristen diese Woche <span aria-hidden>🎉</span>
            </p>
          ) : (
            <>
              <p className="text-base font-semibold text-amber-950">
                {a.dueThisWeekCount}{" "}
                {a.dueThisWeekCount === 1 ? "Frist diese Woche" : "Fristen diese Woche"}
              </p>
              <p className="mt-1 text-sm text-amber-900/80">{a.calendarWeekLabel}</p>
              <ul className="mt-4 space-y-2">
                {a.thisWeekDeadlineDocs.slice(0, WEEK_PREVIEW_MAX).map((doc) => {
                  const m = doc.document_metadata;
                  const title = humanizeDocumentTitle(doc.display_name, doc.original_filename);
                  const cat = doc.category?.trim() || "Ohne Kategorie";
                  const pal = paletteForCategory(cat);
                  const ymd = sliceDueYmd(m?.due_date ?? null);
                  return (
                    <li key={doc.id}>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2.5 text-sm shadow-sm ring-1 ring-zinc-200/60 transition hover:bg-white"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 font-medium text-zinc-900">{title}</span>
                          <span
                            className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${pal.soft} ${pal.text} ${pal.border}`}
                          >
                            {cat}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-zinc-800">
                          {ymd ? formatDate(ymd) : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {a.thisWeekDeadlineDocs.length > WEEK_PREVIEW_MAX ? (
                <p className="mt-3 text-xs text-amber-900/70">
                  +{a.thisWeekDeadlineDocs.length - WEEK_PREVIEW_MAX} weitere —{" "}
                  <Link href="/fristen" className="font-medium underline-offset-2 hover:underline">
                    alle Fristen
                  </Link>
                </p>
              ) : (
                <p className="mt-3 text-xs text-amber-900/70">
                  <Link href="/fristen" className="font-medium underline-offset-2 hover:underline">
                    Fristen-Übersicht
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <DistributionBlock
        title="Nach Dokumenttyp"
        hint="Anteile an deiner Bibliothek (KI-Einstufung)."
        rows={a.byDocumentType.map((r) => ({ key: r.typeKey }))}
        renderRow={(row) => {
          const full = a.byDocumentType.find((r) => r.typeKey === row.key)!;
          return <TypeDistributionRow key={row.key} row={full} maxShare={maxTypeShare} />;
        }}
      />

      <DistributionBlock
        title="Nach Kategorie"
        hint="Wie du Dokumente in der App sortierst."
        rows={a.byCategory.map((r) => ({ key: r.category }))}
        renderRow={(row) => {
          const full = a.byCategory.find((r) => r.category === row.key)!;
          return <CategoryDistributionRow key={row.key} row={full} maxShare={maxCatShare} />;
        }}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Verarbeitungsstatus</h2>
          <p className="mt-1 text-sm text-zinc-500">Wo deine Dokumente im Auswerte-Prozess stehen.</p>
        </div>
        {a.byStatus.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-6 py-10 text-center text-sm text-zinc-500">
            Keine Status-Daten.
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm ring-1 ring-black/[0.03] sm:p-6">
            {a.byStatus.map((row) => {
              const pct = a.total > 0 ? Math.round((row.count / a.total) * 1000) / 10 : 0;
              const label = documentStatusUiLabel(row.status);
              return (
                <div key={row.status} className="space-y-2">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="font-medium text-zinc-800">{label}</span>
                    <span className="tabular-nums text-zinc-600">
                      <span className="font-semibold text-zinc-900">{row.count}</span>
                      <span className="text-zinc-400"> · </span>
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-700"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
