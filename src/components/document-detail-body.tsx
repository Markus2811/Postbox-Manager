"use client";

import type { MouseEvent } from "react";
import { DashboardWorkspaceToggle } from "@/components/dashboard-workspace-toggle";
import { DocumentReanalyzeButton } from "@/components/document-reanalyze-button";
import { documentTypeUiLabel } from "@/lib/documents/categories";
import { formatDate } from "@/lib/documents/format";
import { documentStatusUiLabel } from "@/lib/documents/ui-labels";
import Link from "next/link";

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconBanknote({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFlag({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type DocumentDetailBodyProps = {
  variant?: "page" | "embedded";
  /** Eingebettet unter einer Zeile, die den Titel schon zeigt (z. B. Dashboard-Karte). */
  suppressTitle?: boolean;
  documentId: string;
  title: string;
  sender: string | null;
  workspaceDone: boolean;
  actionRequired: boolean;
  actionDescription: string | null;
  completionNote: string | null;
  documentDate: string | null;
  dueDate: string | null;
  /** Bereits formatierter Betrag oder null */
  amountDisplay: string | null;
  category: string | null;
  summary: string | null;
  documentTypeKey: string | null;
  confidence: number | null;
  status: string;
  mimeType: string | null;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
  fileSize: number | null;
  userEditedAt: string | null;
  aiPlain: string;
  paymentPayer: string | null;
  paymentRecipient: string | null;
  hasMetadata: boolean;
};

const actionBtnPrimary =
  "inline-flex h-11 w-full shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 sm:min-w-0 sm:flex-1 sm:basis-0";

const actionBtnSecondary =
  "inline-flex h-11 w-full shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50/80 sm:min-w-0 sm:flex-1 sm:basis-0";

export function DocumentDetailBody({
  variant = "page",
  suppressTitle = false,
  documentId,
  title,
  sender,
  workspaceDone,
  actionRequired,
  actionDescription,
  completionNote,
  documentDate,
  dueDate,
  amountDisplay,
  category,
  summary,
  documentTypeKey,
  confidence,
  status,
  mimeType,
  originalFilename,
  createdAt,
  updatedAt,
  fileSize,
  userEditedAt,
  aiPlain,
  paymentPayer,
  paymentRecipient,
  hasMetadata,
}: DocumentDetailBodyProps) {
  const embedded = variant === "embedded";
  const titleClass = embedded
    ? "text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
    : "text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[1.75rem] sm:leading-snug";

  const shellProps = embedded
    ? {
        className: "border-t border-zinc-100/80 bg-zinc-50/30 px-4 py-10 sm:px-8",
        onClick: (e: MouseEvent) => e.stopPropagation(),
        role: "region" as const,
        "aria-label": "Dokumentdetails",
      }
    : { className: "" };

  const workspaceBucket = workspaceDone ? ("done" as const) : ("inbox" as const);

  const inner = (
    <div className="mx-auto max-w-2xl">
      {!embedded ? (
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
          <Link href="/dashboard" className="transition hover:text-zinc-900">
            ← Dashboard
          </Link>
          <Link href="/dokumentenliste" className="transition hover:text-zinc-900">
            Dokumente
          </Link>
        </nav>
      ) : null}

      {/* Header: Titel, Datum, Absender, ein Status-Badge */}
      <header className={embedded ? "mt-0 space-y-4" : "mt-10 space-y-4"}>
        {suppressTitle && embedded ? (
          <h2 className="sr-only">{title}</h2>
        ) : embedded ? (
          <h2 className={`${titleClass} line-clamp-2`}>{title}</h2>
        ) : (
          <h1 className={`${titleClass} line-clamp-2`}>{title}</h1>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendar className="size-4 shrink-0 text-zinc-400" aria-hidden />
            <span className="text-zinc-600">
              {documentDate ? formatDate(documentDate) : "Kein Belegdatum"}
            </span>
          </span>
        </div>

        <p className="text-sm leading-relaxed text-zinc-500">
          {sender?.trim() ? (
            <>
              Absender <span className="text-zinc-700">{sender.trim()}</span>
            </>
          ) : (
            <span className="text-zinc-400">Absender unbekannt</span>
          )}
        </p>

        <div>
          {workspaceDone ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200/60">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Erledigt
            </span>
          ) : actionRequired ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200/60">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
              Handlung nötig
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200/80">
              <span className="size-1.5 rounded-full bg-zinc-400" aria-hidden />
              Offen
            </span>
          )}
        </div>

        {actionRequired && actionDescription?.trim() ? (
          <p className="max-w-xl text-sm leading-relaxed text-amber-900/85">{actionDescription.trim()}</p>
        ) : null}
      </header>

      {/* Kerninfos: nur Betrag + Frist */}
      <section
        className={embedded ? "mt-10 border-t border-zinc-100 pt-10" : "mt-12 border-t border-zinc-100 pt-10"}
        aria-labelledby={`key-facts-${documentId}`}
      >
        <h2 id={`key-facts-${documentId}`} className="sr-only">
          Betrag und Frist
        </h2>
        <div className="grid gap-10 sm:grid-cols-2">
          <div className="flex gap-3.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500">
              <IconBanknote className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Betrag</p>
              <p className="mt-1 text-base font-medium tabular-nums text-zinc-900">{amountDisplay ?? "—"}</p>
            </div>
          </div>
          <div className="flex gap-3.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500">
              <IconFlag className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Frist</p>
              <p className="mt-1 text-base font-medium text-zinc-900">{dueDate ? formatDate(dueDate) : "—"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Alle Aktionen an einer Stelle */}
      <section className="mt-12 space-y-3" aria-label="Aktionen">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Aktionen</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          <a href={`/api/documents/${documentId}/download`} className={actionBtnPrimary}>
            Dokument öffnen
          </a>
          <a href={`/api/documents/${documentId}/download`} className={actionBtnSecondary}>
            Download
          </a>
          <div className="min-w-0 sm:flex-1 sm:basis-0">
            <DashboardWorkspaceToggle documentId={documentId} workspace={workspaceBucket} variant="toolbar" />
          </div>
          <div className="w-full shrink-0 sm:w-auto sm:min-w-[11rem] sm:max-w-[16rem] sm:flex-1 sm:basis-0">
            <DocumentReanalyzeButton documentId={documentId} userEditedAt={userEditedAt} compact />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">
          Öffnen und Download nutzen einen kurz gültigen Link. Erneut analysieren wendet die aktuelle Logik erneut an.
          {userEditedAt ? " Titel und Kategorie bleiben bei manueller Bearbeitung erhalten." : null}
        </p>
      </section>

      {completionNote?.trim() ? (
        <div className="mt-10 border-l-2 border-emerald-400/80 py-1 pl-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-800/90">Notiz beim Erledigen</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{completionNote.trim()}</p>
        </div>
      ) : null}

      {summary?.trim() ? (
        <section className="mt-14 space-y-4" aria-labelledby={`sec-summary-${documentId}`}>
          <h2 id={`sec-summary-${documentId}`} className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Kurzüberblick
          </h2>
          <p className="max-w-xl text-[15px] leading-[1.65] text-zinc-600">{summary.trim()}</p>
        </section>
      ) : null}

      {hasMetadata ? (
        <details className="group mt-14 border-t border-zinc-100 pt-2">
          <summary className="cursor-pointer list-none py-3 text-sm font-medium text-zinc-800 marker:hidden select-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Erweiterte Details anzeigen
              <span className="text-zinc-400 transition group-open:rotate-180">▼</span>
            </span>
          </summary>
          <div className="space-y-8 pb-2 pt-2">
            <dl className="grid gap-6 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-400">Kategorie</dt>
                <dd className="mt-1.5 text-zinc-800">{category ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-400">Dokumenttyp (KI)</dt>
                <dd className="mt-1.5 text-zinc-800">{documentTypeUiLabel(documentTypeKey)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-400">Zuverlässigkeit (KI)</dt>
                <dd className="mt-1.5 text-zinc-800">
                  {confidence != null && !Number.isNaN(Number(confidence))
                    ? `${Math.round(Number(confidence) * 100)} %`
                    : "—"}
                </dd>
              </div>
              {paymentPayer?.trim() ? (
                <div>
                  <dt className="text-xs font-medium text-zinc-400">Zahlung von (KI)</dt>
                  <dd className="mt-1.5 text-zinc-800">{paymentPayer.trim()}</dd>
                </div>
              ) : null}
              {paymentRecipient?.trim() ? (
                <div>
                  <dt className="text-xs font-medium text-zinc-400">Zahlung an (KI)</dt>
                  <dd className="mt-1.5 text-zinc-800">{paymentRecipient.trim()}</dd>
                </div>
              ) : null}
            </dl>
            {aiPlain ? (
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Auswertung</h3>
                <div className="mt-3 max-h-[min(24rem,50vh)] max-w-xl overflow-auto text-sm leading-relaxed text-zinc-600">
                  <p className="whitespace-pre-wrap">{aiPlain}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Keine gespeicherte Volltext-Auswertung für dieses Dokument.</p>
            )}
          </div>
        </details>
      ) : (
        <p className="mt-14 text-sm text-zinc-500">Für dieses Dokument liegt noch keine Auswertung vor.</p>
      )}

      <details className="group mt-4 border-t border-zinc-100 pt-2">
        <summary className="cursor-pointer list-none py-3 text-sm font-medium text-zinc-800 marker:hidden select-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Technische Details
            <span className="text-zinc-400 transition group-open:rotate-180">▼</span>
          </span>
        </summary>
        <dl className="grid gap-6 pb-4 pt-2 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-zinc-400">Dateiname</dt>
            <dd className="mt-1.5 break-all font-mono text-xs text-zinc-600">{originalFilename}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-400">Auswertungsstatus</dt>
            <dd className="mt-1.5 text-zinc-800">{documentStatusUiLabel(status)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-400">Dateityp</dt>
            <dd className="mt-1.5 text-zinc-800">{mimeType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-400">Hochgeladen</dt>
            <dd className="mt-1.5 text-zinc-800">{new Date(createdAt).toLocaleString("de-DE")}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-400">Zuletzt geändert</dt>
            <dd className="mt-1.5 text-zinc-800">{new Date(updatedAt).toLocaleString("de-DE")}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-400">Größe</dt>
            <dd className="mt-1.5 text-zinc-800">{fileSize != null ? `${(fileSize / 1024).toFixed(1)} KB` : "—"}</dd>
          </div>
        </dl>
      </details>

      {!embedded ? (
        <p className="mt-14 text-center text-xs text-zinc-400">
          Ablage änderst du auch über <span className="font-medium text-zinc-600">Erledigen</span> oben oder im{" "}
          <Link href="/dashboard" className="font-medium text-zinc-600 underline-offset-2 hover:underline">
            Dashboard
          </Link>
          .
        </p>
      ) : null}
    </div>
  );

  if (embedded) {
    return <div {...shellProps}>{inner}</div>;
  }

  return <div className={shellProps.className}>{inner}</div>;
}
