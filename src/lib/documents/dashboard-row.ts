import type { DocumentWorkspaceBucket } from "@/lib/documents/types";

export type DashboardDocumentRow = {
  id: string;
  display_name: string | null;
  category: string | null;
  status: string;
  original_filename: string;
  created_at: string;
  workspace_bucket: DocumentWorkspaceBucket;
  user_edited_at: string | null;
  /** Notiz beim Erledigen (`raw_ai_json._postbox.completion_note`). */
  completion_note: string | null;
  /** Nur für erweiterte Zeilenansicht; aus bestehendem KI-Roh-JSON abgeleitet. */
  payment_payer: string | null;
  payment_recipient: string | null;
  document_metadata: {
    due_date: string | null;
    action_required: boolean;
    action_description: string | null;
    summary: string | null;
    document_date: string | null;
    document_type: string | null;
    sender: string | null;
    amount: number | string | null;
    currency: string | null;
  } | null;
};
