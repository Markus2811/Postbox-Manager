import { randomUUID } from "node:crypto";

import { mimeForExtension, parseUploadInitPayload } from "@/lib/documents/upload-rules";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Legt die Dokumentzeile an und liefert signierte Storage-Upload-Daten.
 * Die Datei wird anschließend per `uploadToSignedUrl` direkt zu Supabase geladen (kein großer Body durch Next).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = parseUploadInitPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { contentHash, originalFilename, mimeType, fileSize, extension } = parsed.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: dup, error: dupErr } = await supabase
    .from("documents")
    .select("id, original_filename, display_name")
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (dupErr) {
    return NextResponse.json({ error: "Duplikatprüfung fehlgeschlagen." }, { status: 500 });
  }

  if (dup) {
    const label = dup.display_name?.trim() || dup.original_filename;
    return NextResponse.json(
      {
        duplicate: true as const,
        existingId: dup.id,
        existingLabel: label,
      },
      { status: 200 }
    );
  }

  const docId = randomUUID();
  const storagePath = `${user.id}/${docId}/original.${extension}`;

  const { error: insErr } = await supabase.from("documents").insert({
    id: docId,
    user_id: user.id,
    storage_path: storagePath,
    original_filename: originalFilename,
    mime_type: mimeType,
    file_size: fileSize,
    content_hash: contentHash,
    status: "uploaded",
  });

  if (insErr) {
    const isDup =
      insErr.code === "23505" ||
      (insErr.message && /duplicate|unique|content_hash/i.test(insErr.message));
    return NextResponse.json(
      { error: isDup ? "Duplikat: Diese Datei existiert bereits (gleicher Inhalt)." : "Speichern fehlgeschlagen." },
      { status: isDup ? 409 : 500 }
    );
  }

  const { data: signData, error: signErr } = await supabase.storage
    .from("documents")
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (signErr || !signData?.token || !signData?.signedUrl) {
    await supabase.from("documents").delete().eq("id", docId).eq("user_id", user.id);
    return NextResponse.json({ error: "Signed-Upload-URL konnte nicht erstellt werden." }, { status: 500 });
  }

  return NextResponse.json({
    duplicate: false as const,
    documentId: docId,
    path: signData.path,
    token: signData.token,
    contentType: mimeForExtension(extension),
  });
}
