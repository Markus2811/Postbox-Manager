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

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
          >
            ← Zum Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-1 truncate text-xs text-zinc-400" title={doc.original_filename}>
            {doc.original_filename}
          </p>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <strong className="font-semibold">Ablage (erledigt / offen):</strong> nur im{" "}
          <Link href="/dashboard" className="font-medium underline-offset-2 hover:underline">
            Dashboard
          </Link>{" "}
          in der Spalte „Ablage“ – dort optional mit Notiz beim Erledigen.
        </div>

        <section className="space-y-3" aria-labelledby="sec-overview">
          <h2 id="sec-overview" className="text-lg font-semibold text-zinc-900">
            Übersicht
          </h2>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/80">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500">Ablage</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">
                  {workspace === "done" ? "Erledigt" : "Posteingang"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Frist</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">
                  {meta?.due_date ? formatDate(meta.due_date) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Betrag</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">{amountStr ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Absender</dt>
                <dd className="mt-1 text-sm text-zinc-800">{meta?.sender?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Kategorie</dt>
                <dd className="mt-1 text-sm text-zinc-800">{doc.category ?? "—"}</dd>
              </div>
              {completionNote ? (
                <div className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ring-1 ring-emerald-200/80">
                  <dt className="text-xs font-medium text-emerald-800">Notiz beim Erledigen</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{completionNote}</dd>
                </div>
              ) : null}
              {meta?.action_required ? (
                <div className="sm:col-span-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/80">
                  <span className="font-semibold">Handlung nötig</span>
                  {meta.action_description ? ` — ${meta.action_description}` : null}
                </div>
              ) : null}
              {meta?.summary ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-zinc-500">Kurzüberblick</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-zinc-700">{meta.summary}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="sec-file">
          <h2 id="sec-file" className="text-lg font-semibold text-zinc-900">
            Dokument
          </h2>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/80">
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start">
              <a
                href={`/api/documents/${doc.id}/download`}
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                Herunterladen
              </a>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Sicherer Link, kurz gültig.</p>
            <DocumentReanalyzeButton documentId={doc.id} userEditedAt={doc.user_edited_at} />
          </div>
        </section>

        <details className="group rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80">
          <summary className="cursor-pointer list-none px-6 py-4 text-lg font-semibold text-zinc-900 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Details
              <span className="text-sm font-medium text-zinc-500 group-open:hidden">Anzeigen</span>
              <span className="hidden text-sm font-medium text-zinc-500 group-open:inline">Ausblenden</span>
            </span>
          </summary>
          <div className="space-y-8 border-t border-zinc-100 px-6 py-6">
            {meta ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-800">Auswertung</h3>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">Dokumentart (KI)</dt>
                    <dd className="mt-1 text-zinc-800">{documentTypeUiLabel(meta.document_type)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">Dokumentdatum</dt>
                    <dd className="mt-1 text-zinc-800">{meta.document_date ? formatDate(meta.document_date) : "—"}</dd>
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
                  <dd className="mt-1 text-zinc-800">{new Date(doc.created_at).toLocaleString("de-DE")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Zuletzt geändert</dt>
                  <dd className="mt-1 text-zinc-800">{new Date(doc.updated_at).toLocaleString("de-DE")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Dateityp</dt>
                  <dd className="mt-1 text-zinc-800">{doc.mime_type}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Größe</dt>
                  <dd className="mt-1 text-zinc-800">
                    {doc.file_size != null ? `${(doc.file_size / 1024).toFixed(1)} KB` : "—"}
                  </dd>
                </div>
                {meta?.confidence != null && !Number.isNaN(Number(meta.confidence)) ? (
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">Zuverlässigkeit (KI)</dt>
                    <dd className="mt-1 text-zinc-800">{Math.round(Number(meta.confidence) * 100)} %</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {aiPlainExtra ? (
              <div>
                <h3 className="text-sm font-semibold text-zinc-800">Auswertung (Details)</h3>
                <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 ring-1 ring-zinc-200/80">
                  {aiPlainExtra}
                </p>
              </div>
            ) : null}

            {!meta ? (
              <p className="text-sm text-zinc-500">Für dieses Dokument liegt noch keine Auswertung vor.</p>
            ) : null}
          </div>
        </details>
      </main>
    </div>
  );
}
