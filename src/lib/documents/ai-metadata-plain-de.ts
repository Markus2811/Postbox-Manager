import { documentTypeUiLabel } from "@/lib/documents/categories";
import { formatCurrency, formatDate } from "@/lib/documents/format";
import { POSTBOX_EXTRACTED_TEXT_JSON_KEY, POSTBOX_JSON_KEY } from "@/lib/documents/workspace-mvp";

/**
 * Stellt typische KI-Rohfelder aus `raw_ai_json` als Klartext (Deutsch) dar —
 * ohne JSON, für normale Nutzer:innen.
 */
export function formatAiRawJsonAsPlainGerman(raw: Record<string, unknown> | null): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";

  const { [POSTBOX_JSON_KEY]: _pb, ...rest } = raw;
  const lines: string[] = [];

  const docType = rest.document_type;
  if (typeof docType === "string" && docType.trim()) {
    lines.push(`Dokumentart (KI): ${documentTypeUiLabel(docType)}`);
  }

  const sender = rest.sender;
  if (typeof sender === "string" && sender.trim()) {
    lines.push(`Absender: ${sender.trim()}`);
  }

  const docDate = rest.document_date;
  if (docDate != null && String(docDate).trim()) {
    lines.push(`Belegdatum: ${formatDate(String(docDate))}`);
  }

  const due = rest.due_date;
  if (due != null && String(due).trim()) {
    lines.push(`Frist: ${formatDate(String(due))}`);
  }

  const amount = rest.amount;
  const currency = typeof rest.currency === "string" ? rest.currency : "EUR";
  if (amount != null && !Number.isNaN(Number(amount))) {
    lines.push(`Betrag: ${formatCurrency(Number(amount), currency)}`);
  }

  const cat = rest.category;
  if (typeof cat === "string" && cat.trim()) {
    lines.push(`Kategorie (KI): ${cat.trim()}`);
  }

  // summary: bereits unter „Übersicht“ als Kurzüberblick

  if (typeof rest.action_required === "boolean") {
    const desc =
      typeof rest.action_description === "string" && rest.action_description.trim()
        ? ` — ${rest.action_description.trim()}`
        : "";
    lines.push(`Handlung nötig: ${rest.action_required ? "Ja" : "Nein"}${desc}`);
  }

  const conf = rest.confidence;
  if (conf != null && !Number.isNaN(Number(conf))) {
    lines.push(`Einschätzung Zuverlässigkeit (KI): ${Math.round(Number(conf) * 100)} %`);
  }

  const known = new Set([
    "document_type",
    "sender",
    "document_date",
    "due_date",
    "amount",
    "currency",
    "category",
    "summary", // nur in Übersicht, nicht doppelt
    "action_required",
    "action_description",
    "confidence",
    POSTBOX_JSON_KEY,
    POSTBOX_EXTRACTED_TEXT_JSON_KEY,
  ]);

  const extras: string[] = [];
  for (const [k, v] of Object.entries(rest)) {
    if (known.has(k)) continue;
    if (v == null) continue;
    if (typeof v === "object") continue;
    const s = String(v).trim();
    if (!s) continue;
    extras.push(`${humanizeKeyLabel(k)}: ${s}`);
  }
  if (extras.length) {
    lines.push("Weitere Angaben:\n" + extras.join("\n"));
  }

  return lines.filter(Boolean).join("\n\n").trim();
}

function humanizeKeyLabel(key: string): string {
  if (key.length <= 1) return key;
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
