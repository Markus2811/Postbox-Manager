import { AppNav } from "@/components/app-nav";

/** Kein statisches Caching – nach externem Löschen sofort aktuelle Liste. */
export const dynamic = "force-dynamic";
import { DashboardAblageFilter } from "@/components/dashboard-ablage-filter";
import { DashboardDocumentList } from "@/components/dashboard-document-list";
import type { DashboardDocumentRow } from "@/lib/documents/dashboard-row";
import { DashboardInsights } from "@/components/dashboard-insights";
import { DashboardSearch } from "@/components/dashboard-search";
import { computeDashboardSummary, workspaceOf } from "@/lib/documents/dashboard-metrics";
import type { DocumentListRowRaw } from "@/lib/documents/list-documents";
import { listDocumentsForUser } from "@/lib/documents/list-documents";
import { completionNoteFromRawAi } from "@/lib/documents/workspace-mvp";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function normalizeMeta(
  meta: DocumentListRowRaw["document_metadata"]
): DashboardDocumentRow["document_metadata"] {
  if (!meta) return null;
  const m = Array.isArray(meta) ? (meta[0] ?? null) : meta;
  if (!m) return null;
  return {
    due_date: m.due_date,
    action_required: m.action_required,
    action_description: m.action_description ?? null,
    summary: m.summary ?? null,
    document_date: m.document_date ?? null,
    document_type: m.document_type ?? null,
    sender: m.sender ?? null,
    amount: m.amount ?? null,
    currency: m.currency ?? null,
  };
}

function completionNoteFromListMeta(meta: DocumentListRowRaw["document_metadata"]): string | null {
  if (!meta) return null;
  const m = Array.isArray(meta) ? (meta[0] ?? null) : meta;
  if (!m?.raw_ai_json) return null;
  return completionNoteFromRawAi(m.raw_ai_json);
}

function toRows(raw: DocumentListRowRaw[]): DashboardDocumentRow[] {
  return raw.map((d) => ({
    id: d.id,
    display_name: d.display_name,
    category: d.category,
    status: d.status,
    original_filename: d.original_filename,
    created_at: d.created_at,
    workspace_bucket: workspaceOf(d),
    user_edited_at: d.user_edited_at ?? null,
    completion_note: completionNoteFromListMeta(d.document_metadata),
    document_metadata: normalizeMeta(d.document_metadata),
  }));
}

type PageProps = {
  searchParams: Promise<{ q?: string; ablage?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const q = sp.q?.trim() ?? "";
  const ablageParam = sp.ablage;
  const activeAblage =
    ablageParam === "done" ? "done" : ablageParam === "inbox" ? "inbox" : "alle";

  const allDocs = await listDocumentsForUser(supabase, user.id, {
    search: q || undefined,
  });

  const rawDocs =
    activeAblage === "alle"
      ? allDocs
      : allDocs.filter((d) =>
          activeAblage === "done"
            ? workspaceOf(d) === "done"
            : workspaceOf(d) === "inbox"
        );

  const documents = toRows(rawDocs);
  const summary = computeDashboardSummary(allDocs);

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              Übersicht aller Dokumente. <strong className="font-medium text-zinc-800">Erledigt / Wieder öffnen</strong>{" "}
              nur hier in der Spalte „Ablage“ – inkl. optionaler Notiz beim Erledigen. Manuelle Korrekturen der
              KI-Felder in der{" "}
              <Link href="/dokumentenliste" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                Dokumentenliste
              </Link>
              .
            </p>
            <p className="mt-1 text-xs text-zinc-500">Angemeldet als {user.email}</p>
          </div>
          <Suspense fallback={<div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-zinc-100" />}>
            <DashboardSearch key={`${q}-${activeAblage}`} initialQ={q} />
          </Suspense>
        </header>

        <DashboardInsights
          inboxCount={summary.inboxCount}
          doneCount={summary.doneCount}
          totalDocuments={summary.totalDocuments}
        />

        <DashboardAblageFilter activeAblage={activeAblage} />

        <DashboardDocumentList documents={documents} />
      </main>
    </div>
  );
}
