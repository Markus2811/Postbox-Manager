import { addDaysToYmd, calendarWeekRangeMonSun, compareYmd, todayYmd } from "@/lib/documents/format";
import { completionNoteFromRawAi } from "@/lib/documents/workspace-mvp";

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
};

function metaOf(r: AskDocRow) {
  const m = r.document_metadata;
  if (!m) return null;
  return Array.isArray(m) ? m[0] ?? null : m;
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

export function formatAskContextBlock(r: AskDocRow, index: number): string {
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
  return parts.join("\n");
}
