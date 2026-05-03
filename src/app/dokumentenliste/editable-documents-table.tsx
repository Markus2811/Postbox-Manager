import type { DocumentWorkspaceBucket } from "@/lib/documents/types";

/**
 * Zeile für die Dokumentenliste (read-only Ansicht).
 * Bearbeitung erfolgt über die Detailseite / andere Flows.
 */
export type EditableGridRow = {
  id: string;
  original_filename: string;
  display_title: string;
  category: string | null;
  /** Erledigt-Notiz (Anzeige). */
  completion_note: string;
  workspace_label: string;
  workspace_bucket: DocumentWorkspaceBucket;
  status_label: string;
  created_at: string;
  recipient: string;
  payer: string;
  meta: {
    document_type: string;
    document_date: string;
    due_date: string;
    sender: string;
    amount: string;
    currency: string;
    action_required: boolean;
    action_description: string;
    summary: string;
  };
};
