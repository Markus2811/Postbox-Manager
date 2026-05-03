import { DocumentsExportToolbar } from "@/app/dokumentenliste/documents-export-toolbar";
import { DocumentsReadonlyTable } from "@/app/dokumentenliste/documents-readonly-table";
import type { EditableGridRow } from "@/app/dokumentenliste/editable-documents-table";
import { AppNav } from "@/components/app-nav";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import { documentStatusUiLabel } from "@/lib/documents/ui-labels";
import { completionNoteFromRawAi } from "@/lib/documents/workspace-mvp";
import {
  DOCUMENTS_TABLE_PAGE_SIZE,
  listDocumentsPaginated,
} from "@/lib/documents/queries";
import { paymentHintsFromRaw } from "@/lib/documents/table-export";
import type { DocumentWithMetadata } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function toGridRow(doc: DocumentWithMetadata): EditableGridRow {
  const m = doc.document_metadata;
  const hints = paymentHintsFromRaw(m?.raw_ai_json ?? null);
  const meta = m
    ? {
        document_type: m.document_type ?? "",
        document_date: m.document_date ? m.document_date.slice(0, 10) : "",
        due_date: m.due_date ? m.due_date.slice(0, 10) : "",
        sender: m.sender ?? "",
        amount: m.amount != null && !Number.isNaN(Number(m.amount)) ? String(m.amount) : "",
        currency: m.currency ?? "EUR",
        action_required: m.action_required,
        action_description: m.action_description ?? "",
        summary: m.summary ?? "",
      }
    : {
        document_type: "",
        document_date: "",
        due_date: "",
        sender: "",
        amount: "",
        currency: "EUR",
        action_required: false,
        action_description: "",
        summary: "",
      };

  const completion_note = m?.raw_ai_json ? completionNoteFromRawAi(m.raw_ai_json) : null;

  const conf = m?.confidence;
  const confidence =
    conf != null && !Number.isNaN(Number(conf)) ? Number(conf) : null;

  return {
    id: doc.id,
    original_filename: doc.original_filename,
    display_title: humanizeDocumentTitle(doc.display_name, doc.original_filename),
    category: doc.category,
    workspace_label: doc.workspace_bucket === "done" ? "Erledigt" : "Offen",
    workspace_bucket: doc.workspace_bucket,
    status_label: documentStatusUiLabel(doc.status),
    created_at: doc.created_at,
    user_edited_at: doc.user_edited_at ?? null,
    confidence,
    recipient: hints.recipient || "",
    payer: hints.payer || "",
    completion_note: completion_note ?? "",
    meta,
  };
}

const FILTER_PRESETS = {
  "": null,
  finanzen: "Bank & Finanzen",
  vertraege: "Verträge",
} as const;

type ThemaKey = keyof typeof FILTER_PRESETS;

type PageProps = { searchParams: Promise<{ page?: string; thema?: string }> };

export default async function DokumentenlistePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawPage = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const themaRaw = (sp.thema ?? "").toLowerCase();
  const thema: ThemaKey =
    themaRaw === "finanzen" || themaRaw === "vertraege" ? (themaRaw as ThemaKey) : "";
  const categoryFilter = FILTER_PRESETS[thema];
  const themaQuery = thema ? `&thema=${thema}` : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { rows, total } = await listDocumentsPaginated(
    supabase,
    user.id,
    page,
    DOCUMENTS_TABLE_PAGE_SIZE,
    { category: categoryFilter }
  );

  const totalPages = Math.max(1, Math.ceil(total / DOCUMENTS_TABLE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) {
    redirect(`/dokumentenliste?page=${safePage}${themaQuery}`);
  }

  const buildHref = (p: number) => `/dokumentenliste?page=${p}${themaQuery}`;

  const showPageNumbers = totalPages > 1 && totalPages <= 24;
  const gridRows = rows.map(toGridRow);

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dokumente</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              Tabellarische Detailansicht mit allen verfügbaren Feldern (ohne doppelte Spalten). Export CSV / Excel
              rechts – gilt für <strong className="font-medium text-zinc-800">alle</strong> Dokumente, nicht nur die
              aktuelle Seite.
            </p>
          </div>
          <DocumentsExportToolbar />
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Filter</span>
          <Link
            href="/dokumentenliste"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              !thema ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            Alle
          </Link>
          <Link
            href="/dokumentenliste?thema=finanzen"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              thema === "finanzen"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            Bank &amp; Finanzen
          </Link>
          <Link
            href="/dokumentenliste?thema=vertraege"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              thema === "vertraege"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            Verträge
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-600">
            <span className="font-medium text-zinc-900">{total}</span> Dokument(e) gesamt · Seite{" "}
            <span className="font-medium text-zinc-900">{safePage}</span> von{" "}
            <span className="font-medium text-zinc-900">{totalPages}</span>
          </p>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {safePage > 1 ? (
              <Link
                href={buildHref(safePage - 1)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Zurück
              </Link>
            ) : (
              <span className="rounded-lg border border-zinc-100 px-3 py-1.5 text-zinc-400">Zurück</span>
            )}
            {safePage < totalPages ? (
              <Link
                href={buildHref(safePage + 1)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Weiter
              </Link>
            ) : (
              <span className="rounded-lg border border-zinc-100 px-3 py-1.5 text-zinc-400">Weiter</span>
            )}
          </nav>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl bg-white px-6 py-12 text-center text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200/80">
            Noch keine Dokumente. Unter <Link href="/upload" className="font-medium text-zinc-900 underline-offset-2 hover:underline">Upload</Link> kannst du Dateien hinzufügen.
          </div>
        ) : (
          <DocumentsReadonlyTable rows={gridRows} />
        )}

        {showPageNumbers ? (
          <nav className="flex flex-wrap gap-1 text-sm" aria-label="Seiten">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={buildHref(p)}
                className={`min-w-[2.25rem] rounded-md border px-2 py-1 text-center ${
                  p === safePage
                    ? "border-sky-600 bg-sky-50 font-semibold text-sky-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {p}
              </Link>
            ))}
          </nav>
        ) : totalPages > 24 ? (
          <p className="text-xs text-zinc-500">
            Mehr als 24 Seiten: bitte mit „Zurück“ und „Weiter“ blättern (direkte Seitenlinks würden die Seite
            überladen).
          </p>
        ) : null}
      </main>
    </div>
  );
}
