import { isMissingDocumentWorkspaceColumns } from "@/lib/documents/document-workspace-fallback";
import type { SupabaseClient } from "@supabase/supabase-js";

const DETAIL_META = `
        document_type,
        sender,
        document_date,
        due_date,
        amount,
        currency,
        summary,
        action_required,
        action_description,
        confidence,
        raw_ai_json
`;

const DETAIL_SELECT_BASE = `
      id,
      display_name,
      category,
      status,
      original_filename,
      mime_type,
      file_size,
      storage_path,
      created_at,
      updated_at,
      document_metadata (
${DETAIL_META}
      )
    `;

const DETAIL_SELECT_FULL = `
      id,
      display_name,
      category,
      status,
      original_filename,
      mime_type,
      file_size,
      storage_path,
      created_at,
      updated_at,
      workspace_bucket,
      user_edited_at,
      document_metadata (
${DETAIL_META}
      )
    `;

export type DocumentDetailRow = {
  id: string;
  display_name: string | null;
  category: string | null;
  status: string;
  original_filename: string;
  mime_type: string;
  file_size: number | null;
  storage_path: string;
  created_at: string;
  updated_at: string;
  workspace_bucket?: string | null;
  user_edited_at?: string | null;
  document_metadata: unknown;
};

export async function fetchDocumentDetailForUser(
  supabase: SupabaseClient,
  documentId: string,
  userId: string
): Promise<{
  doc: DocumentDetailRow | null;
  queryError: Error | null;
}> {
  const run = (sel: string) =>
    supabase.from("documents").select(sel).eq("id", documentId).eq("user_id", userId).maybeSingle();

  let { data, error } = await run(DETAIL_SELECT_FULL);
  if (error && isMissingDocumentWorkspaceColumns(error.message)) {
    ({ data, error } = await run(DETAIL_SELECT_BASE));
  }
  if (error) {
    return { doc: null, queryError: new Error(error.message) };
  }
  return {
    doc: (data ?? null) as DocumentDetailRow | null,
    queryError: null,
  };
}
