import { resolveOpenAiChatModel } from "@/lib/ai/resolve-openai-model";
import {
  ASK_CONTEXT_EXTRACT_TOTAL,
  detectAskFilters,
  filterAskRows,
  formatAskContextBlock,
  nextCalendarWeekMonSun,
  pickRelevantAskSourceIds,
  type AskDocRow,
} from "@/lib/documents/ask-helpers";
import { humanizeDocumentTitle } from "@/lib/documents/humanize-title";
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

const DOC_ID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLikelyDocumentUuid(id: string): boolean {
  return DOC_ID_UUID_RE.test(id.trim());
}

function parseAskModelJson(content: string): { answer: string; usedDocumentIds: string[] } | null {
  let t = content.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");
  }
  try {
    const o = JSON.parse(t) as { answer?: unknown; usedDocumentIds?: unknown };
    if (typeof o.answer !== "string" || !o.answer.trim()) return null;
    const raw = Array.isArray(o.usedDocumentIds) ? o.usedDocumentIds : [];
    const usedDocumentIds = [
      ...new Set(
        raw.filter((x): x is string => typeof x === "string" && isLikelyDocumentUuid(x)).map((x) => x.trim())
      ),
    ];
    return { answer: o.answer.trim(), usedDocumentIds };
  } catch {
    return null;
  }
}

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
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Du bist ein Assistent für eine private Postbox. Pro Dokument gibt es im Kontext eine Zeile \"ID: <uuid>\", Metadaten, ggf. Notiz beim Erledigen und einen Auszug aus dem gespeicherten Volltext (Extrakt). " +
          "Du antwortest ausschließlich mit einem JSON-Objekt mit genau zwei Schlüsseln: " +
          "\"answer\" (String, deine Antwort an den Nutzer auf Deutsch, kurz und sachlich) und " +
          "\"usedDocumentIds\" (Array von Strings: nur die UUIDs aus den \"ID:\"-Zeilen der Dokumente, die du zur Beantwortung wirklich ausgewertet hast). " +
          "Nur UUIDs aus diesem Kontext — keine erfundenen IDs. " +
          "Wenn die Frage sich eindeutig auf ein einzelnes Dokument bezieht (z. B. Bordkarte, ein Vertrag), enthält usedDocumentIds genau dieses eine Dokument — nicht die übrigen Dokumente, die nur im Kontext standen. " +
          "Bei kombinierten Fragen nur die wirklich nötigen Dokumente auflisten. Wenn keine Quelle passt: usedDocumentIds = []. " +
          "Nutze den Volltext für Detailfragen (Sitzplatz, Flugnummer, Beträge). Wenn der Extrakt fehlt oder gekürzt ist, sage das in answer. Keine erfundenen Details.",
      },
      {
        role: "user",
        content: `Dokumente des Nutzers:\n\n${context}\n\nFrage: ${question}`,
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content?.trim();
  if (!rawContent) {
    return NextResponse.json({ error: "Leere Modell-Antwort" }, { status: 500 });
  }

  const parsed = parseAskModelJson(rawContent);
  if (!parsed) {
    return NextResponse.json({ error: "Antwort konnte nicht verarbeitet werden" }, { status: 500 });
  }

  const validIds = new Set(forContext.map((r) => r.id));
  let sourceIds = parsed.usedDocumentIds.filter((id) => validIds.has(id));

  if (sourceIds.length === 0) {
    sourceIds = pickRelevantAskSourceIds(forContext, question, parsed.answer);
  }

  const rowById = new Map(forContext.map((r) => [r.id, r]));
  const sources = sourceIds
    .map((id) => {
      const r = rowById.get(id);
      if (!r) return null;
      return { id: r.id, title: humanizeDocumentTitle(r.display_name, r.original_filename) };
    })
    .filter((x): x is { id: string; title: string } => x != null);

  return NextResponse.json({ answer: parsed.answer, sources });
}
