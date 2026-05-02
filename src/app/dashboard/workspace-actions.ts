"use server";

import { isMissingDocumentWorkspaceColumns } from "@/lib/documents/document-workspace-fallback";
import { mergePostboxWorkspaceIntoRawAiJson } from "@/lib/documents/workspace-mvp";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function revalidateDocumentRelatedViews(documentId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dokumentenliste");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/analytics");
  revalidatePath("/fragen");
}

export type SetWorkspaceResult = { ok: true } | { ok: false; error: string };

export type SetWorkspaceOptions = {
  completionNote?: string | null;
};

function revalidateAllDocumentRoutes(documentId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dokumentenliste");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/analytics");
  revalidatePath("/fragen");
}

async function syncPostboxInMetadata(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  workspace: "inbox" | "done",
  options?: SetWorkspaceOptions
): Promise<string | null> {
  const { data: row, error: selErr } = await supabase
    .from("document_metadata")
    .select("id, raw_ai_json")
    .eq("document_id", documentId)
    .maybeSingle();

  if (selErr) return selErr.message;

  const mergeOpts =
    workspace === "done" && options != null && "completionNote" in options
      ? { completionNote: options.completionNote ?? null }
      : undefined;

  const merged = mergePostboxWorkspaceIntoRawAiJson(row?.raw_ai_json ?? null, workspace, mergeOpts);

  if (row) {
    const { error } = await supabase
      .from("document_metadata")
      .update({ raw_ai_json: merged })
      .eq("document_id", documentId)
      .eq("user_id", userId);
    return error?.message ?? null;
  }

  if (workspace === "done" && options?.completionNote?.trim()) {
    const { error } = await supabase.from("document_metadata").insert({
      document_id: documentId,
      user_id: userId,
      action_required: false,
      raw_ai_json: merged,
    });
    return error?.message ?? null;
  }

  return null;
}

async function setWorkspaceViaMetadataJson(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  workspace: "inbox" | "done",
  options?: SetWorkspaceOptions
): Promise<{ error: string | null }> {
  const { data: row, error: selErr } = await supabase
    .from("document_metadata")
    .select("id, raw_ai_json")
    .eq("document_id", documentId)
    .maybeSingle();

  if (selErr) {
    return { error: selErr.message };
  }

  const mergeOpts =
    workspace === "done" && options != null && "completionNote" in options
      ? { completionNote: options.completionNote ?? null }
      : undefined;

  const merged = mergePostboxWorkspaceIntoRawAiJson(row?.raw_ai_json ?? null, workspace, mergeOpts);

  if (row) {
    const { error: upErr } = await supabase
      .from("document_metadata")
      .update({ raw_ai_json: merged })
      .eq("document_id", documentId)
      .eq("user_id", userId);
    return { error: upErr?.message ?? null };
  }

  const { error: insErr } = await supabase.from("document_metadata").insert({
    document_id: documentId,
    user_id: userId,
    action_required: false,
    raw_ai_json: merged,
  });
  return { error: insErr?.message ?? null };
}

/**
 * Ablage Posteingang ↔ Erledigt (eine zentrale Server-Aktion).
 * Optional: Notiz beim Erledigen (`raw_ai_json._postbox.completion_note`).
 */
export async function setDocumentWorkspaceBucket(
  documentId: string,
  workspace: "inbox" | "done",
  options?: SetWorkspaceOptions
): Promise<SetWorkspaceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Nicht angemeldet." };
  }

  const { error } = await supabase
    .from("documents")
    .update({ workspace_bucket: workspace })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (!error) {
    const metaErr = await syncPostboxInMetadata(supabase, documentId, user.id, workspace, options);
    if (metaErr) {
      return { ok: false, error: metaErr };
    }
    revalidateAllDocumentRoutes(documentId);
    return { ok: true };
  }

  if (isMissingDocumentWorkspaceColumns(error.message)) {
    const m = await setWorkspaceViaMetadataJson(supabase, documentId, user.id, workspace, options);
    if (m.error) {
      return { ok: false, error: m.error };
    }
    revalidateAllDocumentRoutes(documentId);
    return { ok: true };
  }

  return { ok: false, error: error.message };
}
