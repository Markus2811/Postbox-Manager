import { AppNav } from "@/components/app-nav";
import { DocumentDetailBody } from "@/components/document-detail-body";
import { formatAiRawJsonAsPlainGerman } from "@/lib/documents/ai-metadata-plain-de";
import { fetchDocumentDetailForUser } from "@/lib/documents/document-detail-fetch";
import { formatCurrency } from "@/lib/documents/format";
import { paymentHintsFromRaw } from "@/lib/documents/table-export";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
import {
  completionNoteFromRawAi,
  effectiveDocumentWorkspace,
} from "@/lib/documents/workspace-mvp";
import { createClient } from "@/lib/supabase/server";
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
  const amountDisplay =
    meta?.amount != null && !Number.isNaN(Number(meta.amount))
      ? formatCurrency(Number(meta.amount), meta.currency ?? "EUR")
      : null;
  const aiPlain =
    meta?.raw_ai_json && typeof meta.raw_ai_json === "object" && !Array.isArray(meta.raw_ai_json)
      ? formatAiRawJsonAsPlainGerman(meta.raw_ai_json as Record<string, unknown>)
      : "";
  const completionNote = meta?.raw_ai_json ? completionNoteFromRawAi(meta.raw_ai_json) : null;
  const payHints = paymentHintsFromRaw(meta?.raw_ai_json ?? null);

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-8 sm:py-20">
        <DocumentDetailBody
          variant="page"
          documentId={doc.id}
          title={title}
          sender={meta?.sender ?? null}
          workspaceDone={workspace === "done"}
          actionRequired={!!meta?.action_required}
          actionDescription={meta?.action_description ?? null}
          completionNote={completionNote}
          documentDate={meta?.document_date ?? null}
          dueDate={meta?.due_date ?? null}
          amountDisplay={amountDisplay}
          category={doc.category ?? null}
          summary={meta?.summary ?? null}
          documentTypeKey={meta?.document_type ?? null}
          confidence={meta?.confidence ?? null}
          status={doc.status}
          mimeType={doc.mime_type ?? null}
          originalFilename={doc.original_filename}
          createdAt={doc.created_at}
          updatedAt={doc.updated_at}
          fileSize={doc.file_size}
          userEditedAt={doc.user_edited_at ?? null}
          aiPlain={aiPlain}
          paymentPayer={payHints.payer.trim() || null}
          paymentRecipient={payHints.recipient.trim() || null}
          hasMetadata={!!meta}
        />
      </main>
    </div>
  );
}
