import { runDocumentAnalysis } from "@/lib/documents/run-document-analysis";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type ReanalyzeBody = {
  manualText?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await context.params;
  const id = documentId?.trim();
  if (!id) {
    return NextResponse.json({ error: "Dokument-ID fehlt" }, { status: 400 });
  }

  let body: ReanalyzeBody = {};
  try {
    const raw = await request.json().catch(() => ({}));
    body = typeof raw === "object" && raw !== null ? (raw as ReanalyzeBody) : {};
  } catch {
    body = {};
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const result = await runDocumentAnalysis({
      supabase,
      userId: user.id,
      documentId: id,
      manualText: body.manualText,
    });

    return NextResponse.json({
      ok: true,
      displayName: result.displayName,
      category: result.category,
      analysis: result.analysis,
      preservedDisplayAndCategory: result.preservedDisplayAndCategory,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyse fehlgeschlagen";
    const status = message === "Dokument nicht gefunden" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
