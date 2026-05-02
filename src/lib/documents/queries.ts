import { isMissingDocumentWorkspaceColumns } from "@/lib/documents/document-workspace-fallback";
import type { DocumentMetadataRow, DocumentWithMetadata } from "@/lib/documents/types";
import { effectiveDocumentWorkspace } from "@/lib/documents/workspace-mvp";
import type { SupabaseClient } from "@supabase/supabase-js";

const META = `
    due_date,
    action_required,
    sender,
    summary,
    document_type,
    document_date,
    amount,
    currency,
    action_description,
    confidence,
    raw_ai_json
`;

const SELECT_BASE = `
  id,
  display_name,
  category,
  status,
  original_filename,
  created_at,
  document_metadata (
${META}
  )
`;

const SELECT_FULL = `
  id,
  display_name,
  category,
  status,
  original_filename,
  created_at,
  workspace_bucket,
  user_edited_at,
  document_metadata (
${META}
  )
`;

type RawRow = {
  id: string;
  display_name: string | null;
  category: string | null;
  status: string;
  original_filename: string;
  created_at: string;
  workspace_bucket?: string | null;
  user_edited_at?: string | null;
  document_metadata: DocumentMetadataRow | DocumentMetadataRow[] | null;
};

function normalizeMeta(
  m: RawRow["document_metadata"]
): DocumentMetadataRow | null {
  if (!m) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

function normalizeRow(r: RawRow): DocumentWithMetadata {
  const bucket = effectiveDocumentWorkspace({
    workspace_bucket: r.workspace_bucket,
    document_metadata: r.document_metadata,
  });
  return {
    id: r.id,
    display_name: r.display_name,
    category: r.category,
    status: r.status,
    original_filename: r.original_filename,
    created_at: r.created_at,
    workspace_bucket: bucket,
    user_edited_at: r.user_edited_at ?? null,
    document_metadata: normalizeMeta(r.document_metadata),
  };
}

async function fetchRowsWithWorkspaceFallback(
  supabase: SupabaseClient,
  run: (
    selectStr: string
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<RawRow[]> {
  let { data, error } = await run(SELECT_FULL);
  if (error && isMissingDocumentWorkspaceColumns(error.message)) {
    ({ data, error } = await run(SELECT_BASE));
  }
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as RawRow[];
}

/**
 * Alle Dokumente des Nutzers inkl. Metadaten (RLS: nur eigene Zeilen).
 */
export async function getDocumentsWithMetadata(
  supabase: SupabaseClient,
  userId: string
): Promise<DocumentWithMetadata[]> {
  const rows = await fetchRowsWithWorkspaceFallback(supabase, (sel) =>
    supabase.from("documents").select(sel).eq("user_id", userId).order("created_at", { ascending: false })
  );
  return rows.map(normalizeRow);
}

const DEFAULT_PAGE_SIZE = 30;

/**
 * Eine Seite Dokumente inkl. Metadaten + Gesamtanzahl (für Pagination).
 */
export async function listDocumentsPaginated(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
  options?: { category?: string | null }
): Promise<{ rows: DocumentWithMetadata[]; total: number }> {
  const safePage = Math.max(1, Math.floor(page));
  const size = Math.max(1, Math.min(100, Math.floor(pageSize)));
  const from = (safePage - 1) * size;
  const to = from + size - 1;
  const category = options?.category?.trim() || null;

  let data: unknown;
  let error: { message: string } | null = null;
  let count: number | null = null;

  const run = async (sel: string) => {
    let q = supabase
      .from("documents")
      .select(sel, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (category) {
      q = q.eq("category", category);
    }
    const res = await q;
    return { data: res.data, error: res.error, count: res.count };
  };

  const first = await run(SELECT_FULL);
  data = first.data;
  error = first.error;
  count = first.count;

  if (error && isMissingDocumentWorkspaceColumns(error.message)) {
    const second = await run(SELECT_BASE);
    data = second.data;
    error = second.error;
    count = second.count;
  }

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: ((data ?? []) as RawRow[]).map(normalizeRow),
    total: count ?? 0,
  };
}

export { DEFAULT_PAGE_SIZE as DOCUMENTS_TABLE_PAGE_SIZE };
