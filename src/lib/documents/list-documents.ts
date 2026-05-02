import { isMissingDocumentWorkspaceColumns } from "@/lib/documents/document-workspace-fallback";
import { escapeIlikePattern } from "@/lib/search/escape-ilike";
import type { SupabaseClient } from "@supabase/supabase-js";

const META = `
    due_date,
    action_required,
    sender,
    summary,
    action_description,
    document_date,
    document_type,
    amount,
    currency,
    raw_ai_json
`;

const DOC_SELECT_BASE = `
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

const DOC_SELECT_FULL = `
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

export type DocumentListRowRaw = {
  id: string;
  display_name: string | null;
  category: string | null;
  status: string;
  original_filename: string;
  created_at: string;
  workspace_bucket?: string | null;
  user_edited_at?: string | null;
  document_metadata:
    | {
        due_date: string | null;
        action_required: boolean;
        sender: string | null;
        summary: string | null;
        action_description: string | null;
        document_date: string | null;
        document_type: string | null;
        amount: number | string | null;
        currency: string | null;
        raw_ai_json?: unknown;
      }
    | {
        due_date: string | null;
        action_required: boolean;
        sender: string | null;
        summary: string | null;
        action_description: string | null;
        document_date: string | null;
        document_type: string | null;
        amount: number | string | null;
        currency: string | null;
        raw_ai_json?: unknown;
      }[]
    | null;
};

async function fetchListRows(
  supabase: SupabaseClient,
  run: (
    selectStr: string
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<DocumentListRowRaw[]> {
  let { data, error } = await run(DOC_SELECT_FULL);
  if (error && isMissingDocumentWorkspaceColumns(error.message)) {
    ({ data, error } = await run(DOC_SELECT_BASE));
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentListRowRaw[];
}

export async function listDocumentsForUser(
  supabase: SupabaseClient,
  userId: string,
  options: { search?: string; onlyAction?: boolean; onlyDeadlineSoon?: boolean } = {}
): Promise<DocumentListRowRaw[]> {
  const q = (options.search ?? "").trim().replace(/,/g, " ");

  if (!q) {
    const rows = await fetchListRows(supabase, (sel) =>
      supabase
        .from("documents")
        .select(sel)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    );
    let filtered = rows;
    if (options.onlyAction) {
      filtered = filtered.filter((d) => normalizeMeta(d)?.action_required);
    }
    if (options.onlyDeadlineSoon) {
      filtered = filtered.filter((d) => dueWithinDays(d, 30));
    }
    return filtered;
  }

  const pattern = `%${escapeIlikePattern(q)}%`;

  const { data: byFields, error: e1 } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .or(
      `display_name.ilike.${pattern},original_filename.ilike.${pattern},category.ilike.${pattern}`
    );

  if (e1) throw new Error(e1.message);

  const { data: byMeta, error: e2 } = await supabase
    .from("document_metadata")
    .select("document_id")
    .eq("user_id", userId)
    .or(`sender.ilike.${pattern},summary.ilike.${pattern},action_description.ilike.${pattern}`);

  if (e2) throw new Error(e2.message);

  const ids = new Set<string>();
  for (const r of byFields ?? []) ids.add(r.id);
  for (const r of byMeta ?? []) ids.add(r.document_id);

  if (ids.size === 0) return [];

  const rows = await fetchListRows(supabase, (sel) =>
    supabase
      .from("documents")
      .select(sel)
      .eq("user_id", userId)
      .in("id", [...ids])
      .order("created_at", { ascending: false })
  );
  let filtered = rows;
  if (options.onlyAction) {
    filtered = filtered.filter((d) => normalizeMeta(d)?.action_required);
  }
  if (options.onlyDeadlineSoon) {
    filtered = filtered.filter((d) => dueWithinDays(d, 30));
  }
  return filtered;
}

function normalizeMeta(d: DocumentListRowRaw) {
  const m = d.document_metadata;
  if (!m) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

function dueWithinDays(d: DocumentListRowRaw, days: number): boolean {
  const m = normalizeMeta(d);
  const due = m?.due_date;
  if (!due) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const limit = new Date(start);
  limit.setDate(limit.getDate() + days);
  limit.setHours(23, 59, 59, 999);
  const t = new Date(due + "T12:00:00");
  if (t < start) return true;
  return t >= start && t <= limit;
}
