import { effectiveDocumentWorkspace } from "@/lib/documents/workspace-mvp";
import type { DocumentListRowRaw } from "@/lib/documents/list-documents";

export function workspaceOf(d: DocumentListRowRaw): "inbox" | "done" {
  return effectiveDocumentWorkspace({
    workspace_bucket: d.workspace_bucket,
    document_metadata: d.document_metadata,
  });
}
/** Kompakte Kennzahlen fürs Dashboard (Ablage / Gesamt). */
export function computeDashboardSummary(allDocs: DocumentListRowRaw[]) {
  const inbox = allDocs.filter((d) => workspaceOf(d) === "inbox");
  const done = allDocs.filter((d) => workspaceOf(d) === "done");
  return {
    totalDocuments: allDocs.length,
    inboxCount: inbox.length,
    doneCount: done.length,
  };
}
