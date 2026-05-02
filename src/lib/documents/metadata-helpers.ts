import type { DocumentWithMetadata } from "@/lib/documents/types";

const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

/** Fälligkeitsdatum innerhalb [start, end] (Kalendertage, inkl.) */
export function isDeadlineInRange(
  dueDate: string | null | undefined,
  start: Date,
  end: Date
): boolean {
  const d = parseDateOnly(dueDate);
  if (!d) return false;
  return d >= start && d <= end;
}

export function isToday(dueDate: string | null | undefined): boolean {
  const t = TODAY();
  const e = new Date(t);
  return isDeadlineInRange(dueDate, t, e);
}

export function isDeadlineWithinDays(
  dueDate: string | null | undefined,
  days: number
): boolean {
  const start = TODAY();
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return isDeadlineInRange(dueDate, start, end);
}

/** Für Fristen-Ansicht: Dokument hat relevantes Fälligkeitsdatum in Zukunft oder heute */
export function isDeadlineRelevant(
  dueDate: string | null | undefined,
  maxDaysAhead: number
): boolean {
  const d = parseDateOnly(dueDate);
  if (!d) return false;
  const start = TODAY();
  const limit = new Date(start);
  limit.setDate(limit.getDate() + maxDaysAhead);
  limit.setHours(23, 59, 59, 999);
  return d >= start && d <= limit;
}

const CONTRACT_HINTS =
  /\b(vertrag|abo|abonnement|kündigung|laufzeit|tarif|mobilfunk|dsl|mietvertrag|versicherungsschein|police)\b/i;
const KÜNDIGUNG_HINTS = /\b(kündigung|kündigen|frist|verlängerung|automatisch verlängert)\b/i;

export function isContractLike(doc: DocumentWithMetadata): boolean {
  const m = doc.document_metadata;
  const t = (m?.document_type ?? "").toLowerCase();
  if (t === "contract" || t === "insurance") return true;
  const cat = doc.category ?? "";
  if (cat === "Verträge" || cat === "Versicherungen") return true;
  const blob = `${m?.summary ?? ""} ${m?.sender ?? ""}`;
  return CONTRACT_HINTS.test(blob);
}

export function hasKündigungHint(doc: DocumentWithMetadata): boolean {
  const m = doc.document_metadata;
  const blob = `${m?.summary ?? ""} ${JSON.stringify(m?.raw_ai_json ?? "")}`;
  return KÜNDIGUNG_HINTS.test(blob);
}

export function sortByDueAsc(docs: DocumentWithMetadata[]): DocumentWithMetadata[] {
  return [...docs].sort((a, b) => {
    const da =
      parseDateOnly(a.document_metadata?.due_date ?? null)?.getTime() ??
      Number.POSITIVE_INFINITY;
    const db =
      parseDateOnly(b.document_metadata?.due_date ?? null)?.getTime() ??
      Number.POSITIVE_INFINITY;
    return da - db;
  });
}
