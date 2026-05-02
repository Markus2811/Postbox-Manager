import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { data: doc, error } = await supabase
    .from("documents")
    .select("storage_path, original_filename")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 120);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "Signatur fehlgeschlagen" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
