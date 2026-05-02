"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type GridMetadataPatch = {
  document_type?: string | null;
  document_date?: string | null;
  due_date?: string | null;
  sender?: string | null;
  amount?: number | null;
  currency?: string | null;
  summary?: string | null;
  action_required?: boolean;
  action_description?: string | null;
};

function normalizePatch(patch: GridMetadataPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function updateDocumentMetadataGrid(
  documentId: string,
  patch: GridMetadataPatch
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = normalizePatch(patch);
  if (Object.keys(clean).length === 0) {
    return { ok: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Nicht angemeldet." };
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (docErr || !doc) {
    return { ok: false, error: "Dokument nicht gefunden." };
  }

  const { data: meta } = await supabase
    .from("document_metadata")
    .select("id")
    .eq("document_id", documentId)
    .maybeSingle();

  if (meta) {
    const { error } = await supabase
      .from("document_metadata")
      .update(clean)
      .eq("document_id", documentId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("document_metadata").insert({
      document_id: documentId,
      user_id: user.id,
      action_required: (clean.action_required as boolean | undefined) ?? false,
      ...clean,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dokumentenliste");
  revalidatePath("/dashboard");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/analytics");
  revalidatePath("/fragen");
  return { ok: true };
}
