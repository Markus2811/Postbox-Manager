import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = { documentId?: string };

/**
 * Entfernt eine frische Dokumentzeile, wenn der Storage-Upload nach `upload-init` fehlgeschlagen ist.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!documentId) {
    return NextResponse.json({ error: "documentId fehlt." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id)
    .eq("status", "uploaded");

  if (error) {
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
