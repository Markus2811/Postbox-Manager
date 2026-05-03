export type DocumentMetadataRow = {
  due_date: string | null;
  action_required: boolean;
  sender: string | null;
  summary: string | null;
  document_type: string | null;
  document_date: string | null;
  amount: number | null;
  currency: string | null;
  action_description: string | null;
  confidence: number | null;
  raw_ai_json: Record<string, unknown> | null;
  /** Gespeicherter Volltext (PDF-Extrakt o. ä.); optional, nicht in allen Listen geladen */
  extracted_text?: string | null;
};

export type DocumentWorkspaceBucket = "inbox" | "done";

export type DocumentWithMetadata = {
  id: string;
  display_name: string | null;
  category: string | null;
  status: string;
  original_filename: string;
  created_at: string;
  workspace_bucket: DocumentWorkspaceBucket;
  user_edited_at: string | null;
  document_metadata: DocumentMetadataRow | null;
};
