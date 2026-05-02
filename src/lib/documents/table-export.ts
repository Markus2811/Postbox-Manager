import type { DocumentWithMetadata } from "@/lib/documents/types";

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatAmount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return String(n);
}

function formatConfidence(c: number | null | undefined): string {
  if (c == null || Number.isNaN(Number(c))) return "";
  return `${Math.round(Number(c) * 100)} %`;
}

/**
 * Zusatzfelder aus KI-Roh-JSON (Schema variiert), z. B. Zahlungsempfänger / Zahler.
 */
export function paymentHintsFromRaw(
  raw: Record<string, unknown> | null | undefined
): { recipient: string; payer: string } {
  if (!raw || typeof raw !== "object") return { recipient: "", payer: "" };
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) {
    map.set(k.toLowerCase().replace(/\s+/g, "_"), v);
  }
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const v = map.get(key.toLowerCase());
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  return {
    recipient: pick(
      "payee",
      "recipient",
      "zahlungsempfaenger",
      "payment_recipient",
      "empfaenger",
      "kontoinhaber",
      "iban_holder"
    ),
    payer: pick(
      "payer",
      "debitor",
      "customer",
      "kunde",
      "zahlungspflichtiger",
      "auftraggeber"
    ),
  };
}

const CSV_HEADERS_DE = [
  "Datei",
  "Anzeigename",
  "Kategorie",
  "Ablage",
  "Bearbeitet_am",
  "Status",
  "Hochgeladen",
  "Dokumenttyp",
  "Rechnungsdatum",
  "Frist",
  "Rechnungssteller",
  "Zahlungsempfaenger_KI",
  "Zahler_KI",
  "Betrag",
  "Waehrung",
  "Aktion_noetig",
  "Aktionsbeschreibung",
  "Kurzbeschreibung",
  "Vertrauen",
  "Dokument_ID",
] as const;

function rowToValues(doc: DocumentWithMetadata): string[] {
  const m = doc.document_metadata;
  const hints = paymentHintsFromRaw(m?.raw_ai_json ?? null);
  return [
    doc.original_filename,
    doc.display_name ?? "",
    doc.category ?? "",
    doc.workspace_bucket === "done" ? "Erledigt" : "Posteingang",
    doc.user_edited_at ? formatDate(doc.user_edited_at) : "",
    doc.status,
    formatDate(doc.created_at),
    m?.document_type ?? "",
    formatDate(m?.document_date),
    formatDate(m?.due_date),
    m?.sender ?? "",
    hints.recipient,
    hints.payer,
    formatAmount(m?.amount ?? null),
    m?.currency ?? "",
    m?.action_required ? "ja" : "nein",
    m?.action_description ?? "",
    (m?.summary ?? "").replace(/\r?\n/g, " ").trim(),
    formatConfidence(m?.confidence ?? null),
    doc.id,
  ];
}

function buildCsv(
  docs: DocumentWithMetadata[],
  delimiter: "," | ";",
  prefixLine: string | null
): string {
  const lines: string[] = [];
  if (prefixLine) lines.push(prefixLine);
  lines.push(CSV_HEADERS_DE.join(delimiter));
  for (const doc of docs) {
    lines.push(
      rowToValues(doc)
        .map((v) => csvCell(v))
        .join(delimiter)
    );
  }
  return lines.join("\r\n");
}

/** UTF-8 mit BOM, Komma – universell CSV. */
export function documentsToCsvUtf8BOM(docs: DocumentWithMetadata[]): string {
  const body = buildCsv(docs, ",", null);
  return `\uFEFF${body}`;
}

/** Erste Zeile sep=; + Semikolon – öffnet in deutschsprachigem Excel zuverlässig. */
export function documentsToCsvExcelDe(docs: DocumentWithMetadata[]): string {
  const body = buildCsv(docs, ";", "sep=;");
  return `\uFEFF${body}`;
}
