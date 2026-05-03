import { analyzeWithOpenAI } from "@/lib/ai/analyze-with-openai";
import { categoryFromDocumentType } from "@/lib/documents/categories";
import { buildDisplayName } from "@/lib/documents/display-name";
import { extractDocumentContent } from "@/lib/documents/extract-content";
import { renderPdfFirstPagePngBase64 } from "@/lib/documents/render-pdf-first-page-png";
import {
  POSTBOX_EXTRACTED_TEXT_JSON_KEY,
  POSTBOX_JSON_KEY,
} from "@/lib/documents/workspace-mvp";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

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

type AnalyzeBody = {
  documentId?: string;
  manualText?: string;
};

export async function POST(request: Request) {
  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const documentId = body.documentId?.trim();
  if (!documentId) {
    return NextResponse.json({ error: "documentId fehlt" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select(
      "id, user_id, storage_path, original_filename, mime_type, file_size, created_at"
    )
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  await supabase
    .from("documents")
    .update({ status: "processing" })
    .eq("id", doc.id)
    .eq("user_id", user.id);

  try {
    const { data: blob, error: dlError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (dlError || !blob) {
      throw new Error(dlError?.message ?? "Datei konnte nicht geladen werden");
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const manual = typeof body.manualText === "string" ? body.manualText.trim() : "";

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
    const displayName = buildDisplayName({
      documentDate: analysis.document_date,
      uploadDate: new Date(doc.created_at),
      sender: analysis.sender,
      documentType: analysis.document_type,
      summary: analysis.summary,
      extractedText: combinedExtract,
    });

    const { error: updateDocError } = await supabase
      .from("documents")
      .update({
        display_name: displayName,
        category,
        status: "processed",
      })
      .eq("id", doc.id)
      .eq("user_id", user.id);

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
      user_id: user.id,
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

    return NextResponse.json({
      ok: true,
      displayName,
      category,
      analysis,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyse fehlgeschlagen";
    await supabase
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId)
      .eq("user_id", user.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
