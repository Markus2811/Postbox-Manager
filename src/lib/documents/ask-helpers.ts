import { addDaysToYmd, calendarWeekRangeMonSun, compareYmd, todayYmd } from "@/lib/documents/format";
import {
  completionNoteFromRawAi,
  POSTBOX_EXTRACTED_TEXT_JSON_KEY,
} from "@/lib/documents/workspace-mvp";

/** Max. Zeichen Volltext pro Dokument im Fragen-Kontext. */
export const ASK_CONTEXT_EXTRACT_PER_DOC = 20_000;
/** Summe aller Volltext-Auszüge pro Anfrage (Restbudget fürs Modell). */
export const ASK_CONTEXT_EXTRACT_TOTAL = 120_000;

export type AskFullTextBudget = { remaining: number };

export type AskFilterFlags = {
  /** Fristen in der nächsten Kalenderwoche (Mo–So). */
  dueNextWeek?: boolean;
  /** Nur Uploads der letzten ~6 Monate. */
  lastHalfYear?: boolean;
};

const RE_NEXT_WEEK =
  /nächste\s+woche|nächsten\s+woche|next\s+week|frist.*nächst|deadline.*next|fällig.*nächst|in\s+der\s+nächsten\s+woche/i;
const RE_HALF_YEAR =
  /halbjahr|halb\s+jahr|letzten?\s+6|letzten?\s+sechs|6\s+monat|sechs\s+monat|half\s+year|last\s+six\s+months|vergangenen?\s+6/i;

export function detectAskFilters(question: string): AskFilterFlags {
  const q = question.trim();
  if (!q) return {};
  return {
    dueNextWeek: RE_NEXT_WEEK.test(q),
    lastHalfYear: RE_HALF_YEAR.test(q),
  };
}

/** Montag–Sonntag der Kalenderwoche nach der aktuellen (lokal). */
export function nextCalendarWeekMonSun(): { start: string; end: string } {
  const cur = calendarWeekRangeMonSun(todayYmd());
  return {
    start: addDaysToYmd(cur.end, 1),
    end: addDaysToYmd(cur.end, 7),
  };
}

export function createdAtAfterYmd(createdAtIso: string, minYmd: string): boolean {
  const d = createdAtIso.slice(0, 10);
  return compareYmd(d, minYmd) >= 0;
}

export type AskDocRow = {
  id: string;
  display_name: string | null;
  category: string | null;
  created_at: string;
  original_filename: string;
  workspace_bucket?: string | null;
  document_metadata: AskMeta | AskMeta[] | null;
};

type AskMeta = {
  sender: string | null;
  summary: string | null;
  due_date: string | null;
  document_date: string | null;
  document_type: string | null;
  action_required: boolean | null;
  action_description: string | null;
  amount?: number | string | null;
  currency?: string | null;
  raw_ai_json?: unknown;
  extracted_text?: string | null;
};

function metaOf(r: AskDocRow) {
  const m = r.document_metadata;
  if (!m) return null;
  return Array.isArray(m) ? m[0] ?? null : m;
}

/** Spalte `extracted_text` oder JSON-Fallback (ohne DB-Migration). */
function storedExtractedText(m: AskMeta | null): string | null {
  const col = m?.extracted_text?.trim();
  if (col) return col;
  const raw = m?.raw_ai_json;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>)[POSTBOX_EXTRACTED_TEXT_JSON_KEY];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function filterAskRows(rows: AskDocRow[], flags: AskFilterFlags): AskDocRow[] {
  let out = rows;
  if (flags.lastHalfYear) {
    const min = addDaysToYmd(todayYmd(), -184);
    out = out.filter((r) => createdAtAfterYmd(r.created_at, min));
  }
  if (flags.dueNextWeek) {
    const { start, end } = nextCalendarWeekMonSun();
    out = out.filter((r) => {
      const due = metaOf(r)?.due_date?.slice(0, 10) ?? null;
      if (!due) return false;
      return compareYmd(due, start) >= 0 && compareYmd(due, end) <= 0;
    });
  }
  return out;
}

export function formatAskContextBlock(
  r: AskDocRow,
  index: number,
  fullTextBudget: AskFullTextBudget
): string {
  const m = metaOf(r);
  const note = m?.raw_ai_json ? completionNoteFromRawAi(m.raw_ai_json) : null;
  const parts = [
    `ID: ${r.id}`,
    `Dokument ${index + 1}: ${r.display_name ?? r.original_filename}`,
    `Datei: ${r.original_filename}`,
    `Kategorie: ${r.category ?? "—"}`,
    `Ablage: ${r.workspace_bucket === "done" ? "erledigt" : "Posteingang"}`,
    `Upload-Datum: ${r.created_at?.slice(0, 10) ?? ""}`,
  ];
  if (m) {
    parts.push(
      `Absender: ${m.sender ?? "—"}`,
      `Typ (KI): ${m.document_type ?? "—"}`,
      `Belegdatum: ${m.document_date ?? "—"}`,
      `Frist: ${m.due_date ?? "—"}`,
      `Betrag: ${m.amount != null ? `${m.amount} ${m.currency ?? ""}`.trim() : "—"}`,
      `Handlung nötig: ${m.action_required ? "ja" : "nein"}${m.action_description ? ` (${m.action_description})` : ""}`,
      `Kurzinfo: ${m.summary ?? "—"}`
    );
  }
  if (note) {
    parts.push(`Notiz (beim Erledigen): ${note}`);
  }

  const full = storedExtractedText(m);
  let extractBlock: string;
  if (!full) {
    extractBlock =
      "\nVolltext (Extrakt): — (kein gespeicherter Text; PDF erneut analysieren oder bei reinen Fotos ggf. nur Kurzinfo.)";
  } else if (fullTextBudget.remaining <= 0) {
    extractBlock =
      "\nVolltext (Extrakt): [nicht mitgeschickt — Kontextlimit; nachfragen mit engerem Zeitraum oder weniger Dokumenten]";
  } else {
    const take = Math.min(ASK_CONTEXT_EXTRACT_PER_DOC, fullTextBudget.remaining, full.length);
    let chunk = full.slice(0, take);
    fullTextBudget.remaining -= take;
    if (take < full.length) {
      chunk += "\n[… gekürzt, Rest des Dokuments nicht im Kontext …]";
    }
    extractBlock = `\nVolltext (Extrakt):\n${chunk}`;
  }

  return parts.join("\n") + extractBlock;
}
