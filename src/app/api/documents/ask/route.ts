import { resolveOpenAiChatModel } from "@/lib/ai/resolve-openai-model";
import {
  ASK_CONTEXT_EXTRACT_TOTAL,
  detectAskFilters,
  filterAskRows,
  formatAskContextBlock,
  nextCalendarWeekMonSun,
  type AskDocRow,
} from "@/lib/documents/ask-helpers";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const FETCH_LIMIT = 400;

const ASK_DOCUMENT_METADATA_CORE = `
        sender,
        summary,
        due_date,
        document_date,
        document_type,
        action_required,
        action_description,
        amount,
        currency,
        raw_ai_json`;

function isMissingExtractedTextSelectError(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.includes("extracted_text")) return false;
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("unknown column")
  );
}

type Body = { question?: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Frage fehlt" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const selectFullWithExtract = `
      id,
      display_name,
      category,
      created_at,
      original_filename,
      workspace_bucket,
      document_metadata (
        ${ASK_DOCUMENT_METADATA_CORE},
        extracted_text
      )
    `;
  const selectFullNoExtract = `
      id,
      display_name,
      category,
      created_at,
      original_filename,
      workspace_bucket,
      document_metadata (
        ${ASK_DOCUMENT_METADATA_CORE}
      )
    `;
  const selectBaseWithExtract = `
      id,
      display_name,
      category,
      created_at,
      original_filename,
      document_metadata (
        ${ASK_DOCUMENT_METADATA_CORE},
        extracted_text
      )
    `;
  const selectBaseNoExtract = `
      id,
      display_name,
      category,
      created_at,
      original_filename,
      document_metadata (
        ${ASK_DOCUMENT_METADATA_CORE}
      )
    `;

  let first = await supabase
    .from("documents")
    .select(selectFullWithExtract)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (first.error && isMissingExtractedTextSelectError(first.error.message ?? "")) {
    first = (await supabase
      .from("documents")
      .select(selectFullNoExtract)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT)) as typeof first;
  }

  let rawRows: AskDocRow[];
  if (first.error?.message?.includes("workspace_bucket")) {
    let second = await supabase
      .from("documents")
      .select(selectBaseWithExtract)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (second.error && isMissingExtractedTextSelectError(second.error.message ?? "")) {
      second = (await supabase
        .from("documents")
        .select(selectBaseNoExtract)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT)) as typeof second;
    }
    if (second.error) {
      return NextResponse.json({ error: second.error.message }, { status: 500 });
    }
    rawRows = (second.data ?? []) as AskDocRow[];
  } else if (first.error) {
    return NextResponse.json({ error: first.error.message }, { status: 500 });
  } else {
    rawRows = (first.data ?? []) as AskDocRow[];
  }
  const flags = detectAskFilters(question);
  const filtered = filterAskRows(rawRows, flags);

  let preface = "";
  if (flags.dueNextWeek || flags.lastHalfYear) {
    const bits: string[] = [];
    if (flags.dueNextWeek) {
      const w = nextCalendarWeekMonSun();
      bits.push(`Frist-Kalenderwoche (automatisch): ${w.start} bis ${w.end}`);
    }
    if (flags.lastHalfYear) {
      bits.push("Upload-Zeitraum (automatisch): etwa die letzten 6 Monate");
    }
    preface = `[Automatische Vorauswahl: ${bits.join("; ")}. Treffer: ${filtered.length}.]\n\n`;
    if (filtered.length === 0) {
      preface +=
        "[Hinweis: Kein Dokument erfüllt die Vorauswahl. Es folgt die allgemeine Liste der zuletzt geladenen Dokumente.]\n\n";
    }
  }

  const forContext = filtered.length > 0 ? filtered : rawRows.slice(0, 150);
  const fullTextBudget = { remaining: ASK_CONTEXT_EXTRACT_TOTAL };
  const blocks = forContext.map((r, i) => formatAskContextBlock(r, i, fullTextBudget));

  const context =
    blocks.length > 0
      ? preface + blocks.join("\n\n---\n\n")
      : "(Noch keine Dokumente mit Metadaten.)";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY fehlt" }, { status: 500 });
  }

  const model = resolveOpenAiChatModel();
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content:
          "Du bist ein Assistent für eine private Postbox. Die Nutzerfrage bezieht sich auf die mitgelieferte Dokumentliste (Metadaten, Kurzinfo, ggf. Notiz beim Erledigen) und pro Dokument auf einen Auszug aus dem gespeicherten maschinenlesbaren Volltext (Extrakt), sofern vorhanden. " +
          "Nutze den Volltext-Auszug für Detailfragen (z. B. Sitzplatz, Flugnummer, Adressen im Fließtext). Wenn der Extrakt fehlt, gekürzt wurde oder das Kontextlimit weitere Volltexte ausließ, sage das klar. " +
          "Antworte nur auf Basis dieser Daten. Wenn etwas unklar ist oder nicht in den Daten steht, sage das. " +
          "Bei Listen nenne konkrete Dokumenttitel oder Absender aus den Daten. Kurz und auf Deutsch, keine erfundenen Details.",
      },
      {
        role: "user",
        content: `Dokumente des Nutzers:\n\n${context}\n\nFrage: ${question}`,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  if (!answer) {
    return NextResponse.json({ error: "Leere Modell-Antwort" }, { status: 500 });
  }

  return NextResponse.json({ answer });
}
