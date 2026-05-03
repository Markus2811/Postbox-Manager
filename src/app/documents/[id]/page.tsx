import { AppNav } from "@/components/app-nav";
import { DocumentReanalyzeButton } from "@/components/document-reanalyze-button";
import { formatAiRawJsonAsPlainGerman } from "@/lib/documents/ai-metadata-plain-de";
import { fetchDocumentDetailForUser } from "@/lib/documents/document-detail-fetch";
import { formatCurrency, formatDate } from "@/lib/documents/format";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import {
  completionNoteFromRawAi,
  effectiveDocumentWorkspace,
} from "@/lib/documents/workspace-mvp";
import { documentTypeUiLabel } from "@/lib/documents/categories";
import { documentStatusUiLabel } from "@/lib/documents/ui-labels";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { doc, queryError } = await fetchDocumentDetailForUser(supabase, id, user.id);

  if (queryError) {
    notFound();
  }
  if (!doc) {
    notFound();
  }

  const metaRaw = doc.document_metadata;
  const meta = Array.isArray(metaRaw) ? metaRaw[0] : metaRaw;
  const workspace = effectiveDocumentWorkspace({
    workspace_bucket: doc.workspace_bucket,
    document_metadata: doc.document_metadata,
  });

  const title = humanizeDocumentTitle(doc.display_name, doc.original_filename);
  const amountStr =
    meta?.amount != null && !Number.isNaN(Number(meta.amount))
      ? formatCurrency(Number(meta.amount), meta.currency ?? "EUR")
      : null;
  const aiPlainExtra =
    meta?.raw_ai_json && typeof meta.raw_ai_json === "object" && !Array.isArray(meta.raw_ai_json)
      ? formatAiRawJsonAsPlainGerman(meta.raw_ai_json as Record<string, unknown>)
      : "";
  const completionNote = meta?.raw_ai_json ? completionNoteFromRawAi(meta.raw_ai_json) : null;

  const done = workspace === "done";

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
          <Link href="/dashboard" className="hover:text-zinc-900 hover:underline">
            ← Dashboard
          </Link>
          <Link href="/dokumentenliste" className="hover:text-zinc-900 hover:underline">
            Dokumente
          </Link>
        </nav>

        <header className="mt-8 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-[2rem] sm:leading-tight">
              {title}
            </h1>
            <p className="text-sm text-zinc-500">
              {meta?.sender?.trim() ? (
                <>
                  Absender: <span className="text-zinc-700">{meta.sender.trim()}</span>
                </>
              ) : (
                <span className="text-zinc-400">Absender unbekannt</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                done
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80"
                  : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-zinc-400"}`} aria-hidden />
              {done ? "Erledigt" : "Offen"}
            </span>
            {meta?.action_required ? (
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
                Handlung nötig
              </span>
            ) : null}
          </div>
        </header>

        <section className="mt-10 space-y-3" aria-label="Aktionen">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={`/api/documents/${doc.id}/download`}
              className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 sm:flex-initial"
            >
              Dokument öffnen
            </a>
            <a
              href={`/api/documents/${doc.id}/download`}
              className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-center text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 sm:flex-initial"
            >
              Download
            </a>
            <DocumentReanalyzeButton
              documentId={doc.id}
              userEditedAt={doc.user_edited_at}
              className="flex-1 sm:flex-initial"
            />
          </div>
          <p className="text-xs text-zinc-400">Öffnen und Download nutzen einen kurz gültigen, sicheren Link.</p>
        </section>

        <section className="mt-12" aria-labelledby="key-facts">
          <h2 id="key-facts" className="sr-only">
            Kennzahlen
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex gap-3">
              <span className="mt-0.5 text-zinc-400">
                <IconCalendar className="text-zinc-400" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Datum</p>
                <p className="mt-0.5 text-sm font-medium text-zinc-900">
                  {meta?.document_date ? formatDate(meta.document_date) : "—"}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 text-zinc-400">
                <IconBanknote className="text-zinc-400" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Betrag</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums text-zinc-900">{amountStr ?? "—"}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 text-zinc-400">
                <IconFlag className="text-zinc-400" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Frist</p>
                <p className="mt-0.5 text-sm font-medium text-zinc-900">
                  {meta?.due_date ? formatDate(meta.due_date) : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {meta?.action_required ? (
          <div className="mt-10 rounded-xl bg-amber-50/90 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/70">
            <span className="font-semibold">Handlung nötig</span>
            {meta.action_description ? ` — ${meta.action_description}` : null}
          </div>
        ) : null}

        {completionNote ? (
          <div className="mt-6 rounded-xl bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-200/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Notiz beim Erledigen</p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{completionNote}</p>
          </div>
        ) : null}

        {meta?.summary?.trim() ? (
          <section className="mt-12 space-y-3" aria-labelledby="sec-summary">
            <h2 id="sec-summary" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Kurzüberblick
            </h2>
            <p className="max-w-prose text-base leading-relaxed text-zinc-700">{meta.summary.trim()}</p>
          </section>
        ) : null}

        {aiPlainExtra ? (
          <section className="mt-12 space-y-3" aria-labelledby="sec-auswertung">
            <h2 id="sec-auswertung" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Auswertung
            </h2>
            <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-xl bg-white/80 px-4 py-4 text-sm leading-relaxed text-zinc-700 shadow-sm ring-1 ring-zinc-200/60">
              <p className="whitespace-pre-wrap">{aiPlainExtra}</p>
            </div>
          </section>
        ) : meta ? (
          <p className="mt-10 text-sm text-zinc-500">Keine gespeicherte Volltext-Auswertung für dieses Dokument.</p>
        ) : (
          <p className="mt-10 text-sm text-zinc-500">Für dieses Dokument liegt noch keine Auswertung vor.</p>
        )}

        {meta ? (
          <details className="group mt-12 border-b border-zinc-200/90 pb-2">
            <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-zinc-900 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Erweiterte Details anzeigen
                <span className="text-xs font-normal text-zinc-400 group-open:hidden">▼</span>
                <span className="hidden text-xs font-normal text-zinc-400 group-open:inline">▲</span>
              </span>
            </summary>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500">Kategorie</dt>
                <dd className="mt-1 text-zinc-800">{doc.category ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Dokumenttyp (KI)</dt>
                <dd className="mt-1 text-zinc-800">{documentTypeUiLabel(meta.document_type)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Zuverlässigkeit (KI)</dt>
                <dd className="mt-1 text-zinc-800">
                  {meta.confidence != null && !Number.isNaN(Number(meta.confidence))
                    ? `${Math.round(Number(meta.confidence) * 100)} %`
                    : "—"}
                </dd>
              </div>
            </dl>
          </details>
        ) : null}

        <details className="group mt-6 border-b border-zinc-200/90 pb-2">
          <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-zinc-900 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Technische Details
              <span className="text-xs font-normal text-zinc-400 group-open:hidden">▼</span>
              <span className="hidden text-xs font-normal text-zinc-400 group-open:inline">▲</span>
            </span>
          </summary>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500">Dateiname</dt>
              <dd className="mt-1 break-all font-mono text-xs text-zinc-700">{doc.original_filename}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Auswertungsstatus</dt>
              <dd className="mt-1 text-zinc-800">{documentStatusUiLabel(doc.status)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Dateityp</dt>
              <dd className="mt-1 text-zinc-800">{doc.mime_type ?? "—"}</dd>
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
              <dt className="text-xs font-medium text-zinc-500">Größe</dt>
              <dd className="mt-1 text-zinc-800">
                {doc.file_size != null ? `${(doc.file_size / 1024).toFixed(1)} KB` : "—"}
              </dd>
            </div>
          </dl>
        </details>

        <p className="mt-10 text-center text-xs text-zinc-400">
          Ablage (erledigt / offen) änderst du im{" "}
          <Link href="/dashboard" className="font-medium text-zinc-600 underline-offset-2 hover:underline">
            Dashboard
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
