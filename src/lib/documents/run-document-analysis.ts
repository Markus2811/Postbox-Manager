import type { DocumentAnalysis } from "@/lib/ai/document-analysis-schema";
import { analyzeWithOpenAI } from "@/lib/ai/analyze-with-openai";
import { categoryFromDocumentType } from "@/lib/documents/categories";
import { buildDocumentNamesFromAnalysis } from "@/lib/documents/document-naming";
import { isMissingDocumentWorkspaceColumns } from "@/lib/documents/document-workspace-fallback";
import { extractDocumentContent } from "@/lib/documents/extract-content";
import { renderPdfFirstPagePngBase64 } from "@/lib/documents/render-pdf-first-page-png";
import {
  POSTBOX_EXTRACTED_TEXT_JSON_KEY,
  POSTBOX_JSON_KEY,
} from "@/lib/documents/workspace-mvp";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Produktions-DB ohne Migration: PostgREST meldet fehlende Spalte internal_name. */
function isMissingInternalNameColumn(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.includes("internal_name")) return false;
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("unknown column")
  );
}

/** Produktions-DB ohne Migration: PostgREST/Postgres meldet fehlende Spalte extracted_text. */
function isMissingExtractedTextColumn(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.includes("extracted_text")) return false;
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("unknown column")
  );
}

export type RunDocumentAnalysisOptions = {
  supabase: SupabaseClient;
  userId: string;
  documentId: string;
  manualText?: string;
  /**
   * false = immer KI-Titel & Kategorie schreiben (Upload-Analyse).
   * undefined = an `documents.user_edited_at` koppeln (Re-Analyse: manuelle Stammdaten behalten).
   * true = Titel/Kategorie nicht überschreiben.
   */
  preserveUserDocumentFields?: boolean;
};

export type RunDocumentAnalysisResult = {
  displayName: string;
  category: string;
  analysis: DocumentAnalysis;
  preservedDisplayAndCategory: boolean;
};

/**
 * Lädt die Datei aus Storage (Pfad nur aus der DB), extrahiert Text, ruft die KI-Analyse auf
 * und schreibt Ergebnis in `documents` / `document_metadata`. Wird vom Upload-Analyse-Endpoint
 * und von Re-Analyse genutzt.
 */
export async function runDocumentAnalysis(
  options: RunDocumentAnalysisOptions
): Promise<RunDocumentAnalysisResult> {
  const { supabase, userId, documentId, manualText } = options;

  const selectFull =
    "id, user_id, storage_path, original_filename, mime_type, file_size, created_at, user_edited_at";
  const selectBase =
    "id, user_id, storage_path, original_filename, mime_type, file_size, created_at";

  let { data: doc, error: docError } = await supabase
    .from("documents")
    .select(selectFull)
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (docError && isMissingDocumentWorkspaceColumns(docError.message)) {
    ({ data: doc, error: docError } = await supabase
      .from("documents")
      .select(selectBase)
      .eq("id", documentId)
      .eq("user_id", userId)
      .maybeSingle());
  }

  if (docError) {
    throw new Error(docError.message || "Dokument konnte nicht geladen werden");
  }
  if (!doc) {
    throw new Error("Dokument nicht gefunden");
  }

  const userEditedAt =
    "user_edited_at" in doc ? (doc as { user_edited_at?: string | null }).user_edited_at : null;

  const preserveUserDocumentFields =
    options.preserveUserDocumentFields === undefined
      ? Boolean(userEditedAt)
      : options.preserveUserDocumentFields;

  await supabase
    .from("documents")
    .update({ status: "processing" })
    .eq("id", doc.id)
    .eq("user_id", userId);

  try {
    const { data: blob, error: dlError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (dlError || !blob) {
      throw new Error(dlError?.message ?? "Datei konnte nicht geladen werden");
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const manual = typeof manualText === "string" ? manualText.trim() : "";

    let text = manual;
    let imageBase64: string | undefined;
    let visionMimeForOpenAi = doc.mime_type;

    if (!text) {
      const extracted = await extractDocumentContent(buffer, doc.mime_type);
      text = extracted.text;
      if (extracted.needsVision && doc.mime_type.startsWith("image/")) {
        imageBase64 = buffer.toString("base64");
      } else if (extracted.needsVision && doc.mime_type.toLowerCase() === "application/pdf") {
        const pngB64 = await renderPdfFirstPagePngBase64(buffer);
        if (pngB64) {
          imageBase64 = pngB64;
          visionMimeForOpenAi = "image/png";
        }
      }
    }

    const analysis = await analyzeWithOpenAI({
      text,
      originalFilename: doc.original_filename,
      mimeType: visionMimeForOpenAi,
      imageBase64,
    });

    const MAX_STORED_EXTRACTED = 64_000;
    const transcript = (analysis.image_transcript ?? "").trim();
    const combinedExtract = [text.trim(), transcript].filter(Boolean).join("\n\n---\n\n");
    const extractedTextForDb = combinedExtract.slice(0, MAX_STORED_EXTRACTED);

    const category = categoryFromDocumentType(analysis.document_type);
    const names = buildDocumentNamesFromAnalysis({
      documentType: analysis.document_type,
      categoryLabel: category,
      sender: analysis.sender,
      summary: analysis.summary,
      documentDate: analysis.document_date,
      uploadDate: new Date(doc.created_at),
      extractedText: combinedExtract,
    });
    const displayName = names.display_name;

    const docUpdate: Record<string, unknown> = {
      status: "processed",
    };
    if (!preserveUserDocumentFields) {
      docUpdate.display_name = displayName;
      docUpdate.category = category;
      docUpdate.internal_name = names.machine_name;
    }

    let updateDocError = (
      await supabase.from("documents").update(docUpdate).eq("id", doc.id).eq("user_id", userId)
    ).error;

    if (updateDocError && isMissingInternalNameColumn(updateDocError.message ?? "")) {
      const { internal_name: _i, ...withoutInternal } = docUpdate;
      updateDocError = (
        await supabase
          .from("documents")
          .update(withoutInternal)
          .eq("id", doc.id)
          .eq("user_id", userId)
      ).error;
    }

    if (updateDocError) {
      throw updateDocError;
    }

    const rawPayload = { ...analysis } as Record<string, unknown>;
    delete rawPayload.image_transcript;
    delete rawPayload[POSTBOX_EXTRACTED_TEXT_JSON_KEY];

    const { data: existingMeta } = await supabase
      .from("document_metadata")
      .select("raw_ai_json")
      .eq("document_id", doc.id)
      .maybeSingle();

    const existingRaw = existingMeta?.raw_ai_json;
    if (existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw)) {
      const preserved = (existingRaw as Record<string, unknown>)[POSTBOX_JSON_KEY];
      if (preserved != null) {
        rawPayload[POSTBOX_JSON_KEY] = preserved;
      }
    }

    const metaBase = {
      document_id: doc.id,
      user_id: userId,
      document_type: analysis.document_type,
      sender: analysis.sender,
      document_date: analysis.document_date,
      due_date: analysis.due_date,
      amount: analysis.amount,
      currency: analysis.currency,
      summary: analysis.summary,
      action_required: analysis.action_required,
      action_description: analysis.action_description,
      confidence: analysis.confidence,
      raw_ai_json: rawPayload,
    };

    let metaError = (
      await supabase.from("document_metadata").upsert(
        {
          ...metaBase,
          extracted_text: extractedTextForDb.length > 0 ? extractedTextForDb : null,
        },
        { onConflict: "document_id" }
      )
    ).error;

    if (metaError && isMissingExtractedTextColumn(metaError.message ?? "")) {
      if (extractedTextForDb.length > 0) {
        rawPayload[POSTBOX_EXTRACTED_TEXT_JSON_KEY] = extractedTextForDb;
      }
      metaError = (await supabase.from("document_metadata").upsert(metaBase, { onConflict: "document_id" })).error;
    }

    if (metaError) {
      throw metaError;
    }

    return {
      displayName,
      category,
      analysis,
      preservedDisplayAndCategory: preserveUserDocumentFields,
    };
  } catch (e) {
    await supabase
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId)
      .eq("user_id", userId);
    throw e;
  }
}
