"use server";

import { documentsToCsvExcelDe, documentsToCsvUtf8BOM } from "@/lib/documents/table-export";
import { getDocumentsWithMetadata } from "@/lib/documents/queries";
import { createClient } from "@/lib/supabase/server";

export type ExportPayload = { content: string; filename: string };

function stampFilename(prefix: string) {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${prefix}-${y}${mo}${day}.csv`;
}

export async function downloadDocumentsCsvComma(): Promise<ExportPayload> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const docs = await getDocumentsWithMetadata(supabase, user.id);
  return {
    content: documentsToCsvUtf8BOM(docs),
    filename: stampFilename("dokumente"),
  };
}

/** Semikolon + sep=; – gut für Microsoft Excel (DE). */
export async function downloadDocumentsCsvExcelDe(): Promise<ExportPayload> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const docs = await getDocumentsWithMetadata(supabase, user.id);
  return {
    content: documentsToCsvExcelDe(docs),
    filename: stampFilename("dokumente-excel"),
  };
}
