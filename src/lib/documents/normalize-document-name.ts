/**
 * Deterministische, menschenlesbare Namenskonvention:
 * [Kategorie]_[Absender]_[Thema]_[Datum] (machine) und Leerzeichen-Variante für UI.
 */

import type { DocumentTypeKey } from "@/lib/documents/categories";
import { DOCUMENT_TYPES } from "@/lib/documents/categories";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LEGAL_SUFFIX = new RegExp(
  `\\s+(GmbH|Gmbh|AG|KG|OHG|UG\\s*\\(haftungsbeschränkt\\)|UG|SE|e\\.\\s*V\\.|e\\.V\\.|eV|Ltd\\.?|Limited|Gbr|GbR|mbH|Co\\.\\s*KG|UK)\\s*$`,
  "i"
);

const TOPIC_STOP = new Set(
  [
    "der",
    "die",
    "das",
    "und",
    "oder",
    "für",
    "fur",
    "von",
    "zu",
    "aus",
    "mit",
    "im",
    "in",
    "am",
    "an",
    "auf",
    "uber",
    "über",
    "sich",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
    "bei",
    "zum",
    "vom",
    "als",
    "wir",
    "ihr",
    "sie",
    "mitteilung",
    "dokument",
    "schreiben",
    "sehr",
    "geehrte",
    "damen",
    "herren",
    "betrag",
    "betrifft",
    "datum",
    "nr",
    "no",
    "nummer",
    "bitte",
    "nachricht",
    "email",
    "mailto",
    "http",
    "https",
    "www",
    "com",
    "eur",
    "euro",
    "vom",
    "rechnung",
    "steuer",
    "steuerbescheid",
    "vertrag",
    "versicherung",
  ].map((w) => w.toLowerCase())
);

export type NormalizeDocumentNameInput = {
  documentType: string | null | undefined;
  sender: string | null | undefined;
  summary: string | null | undefined;
  documentDate: string | null | undefined;
  uploadDate: Date;
  extractedText?: string | null;
};

function toAsciiSlugPart(raw: string): string {
  const folded = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue");
  return folded
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function collapseUnderscores(s: string): string {
  return s.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function mapCategory(documentType: string | null | undefined): string {
  const raw = (documentType ?? "other").toLowerCase();
  const t = (DOCUMENT_TYPES as readonly string[]).includes(raw)
    ? (raw as DocumentTypeKey)
    : ("other" as DocumentTypeKey);
  switch (t) {
    case "invoice":
      return "Rechnung";
    case "tax":
      return "Steuer";
    case "contract":
      return "Vertrag";
    case "insurance":
      return "Versicherung";
    default:
      return "Sonstiges";
  }
}

function stripLegalEntity(name: string): string {
  let s = name.trim().replace(LEGAL_SUFFIX, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function senderSegment(sender: string | null | undefined): string {
  const raw = (sender ?? "").trim();
  if (!raw) return "Unbekannt";
  const cleaned = stripLegalEntity(raw);
  const words = cleaned
    .split(/[\s,;/|]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (words.length === 0) return "Unbekannt";
  const joined = words.map((w) => toAsciiSlugPart(w)).filter(Boolean).join("_");
  return collapseUnderscores(joined) || "Unbekannt";
}

function categoryLower(cat: string): string {
  return cat.toLowerCase();
}

function topicWordsFromText(
  combined: string,
  categoryLabel: string,
  maxWords: number,
  senderMachine: string
): string[] {
  const catLc = categoryLower(categoryLabel);
  const senderTokens = new Set(
    senderMachine
      .split("_")
      .map((p) => p.toLowerCase())
      .filter(Boolean)
  );
  const tokens = combined
    .replace(/[_/]+/g, " ")
    .split(/[^a-zA-Z0-9äöüÄÖÜß]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  const out: string[] = [];
  for (const raw of tokens) {
    const lc = raw.toLowerCase();
    if (TOPIC_STOP.has(lc)) continue;
    if (lc === catLc) continue;
    if (senderTokens.has(lc)) continue;
    if (/^\d+([.,]\d+)?$/.test(lc)) continue;
    out.push(raw);
    if (out.length >= maxWords) break;
  }
  return out;
}

function topicSegment(
  summary: string | null | undefined,
  extractedText: string | null | undefined,
  categoryLabel: string,
  senderMachine: string
): string {
  const sum = (summary ?? "").trim();
  const ext = (extractedText ?? "").trim().slice(0, 1200);
  const combined = [sum, ext].filter(Boolean).join(" ");
  if (!combined) return "Mitteilung";

  let words = topicWordsFromText(combined, categoryLabel, 5, senderMachine);
  if (words.length === 0) {
    words = topicWordsFromText(combined.replace(/\s+/g, " "), categoryLabel, 5, senderMachine);
  }
  if (words.length === 0) return "Mitteilung";

  const slug = words
    .map((w) => toAsciiSlugPart(w))
    .filter(Boolean)
    .join("_");
  return collapseUnderscores(slug) || "Mitteilung";
}

function uploadDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateFromLooseText(text: string): string | null {
  const re = /\b(\d{1,2})[.](\d{1,2})[.](\d{4})\b/g;
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = re.exec(text)) !== null) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    const ymd = `${yyyy}-${mm}-${dd}`;
    if (ISO_DATE.test(ymd)) last = ymd;
  }
  return last;
}

function resolveDateYmd(
  documentDate: string | null | undefined,
  uploadDate: Date,
  combinedText: string
): string {
  if (documentDate && ISO_DATE.test(documentDate)) return documentDate;
  const fromText = parseDateFromLooseText(combinedText);
  if (fromText) return fromText;
  return uploadDateYmd(uploadDate);
}

const MAX_MACHINE_LEN = 80;

/**
 * Liefert `machine_name` (Unterstriche, speichertauglich) und `display_name` (Leerzeichen, UI).
 * Gleiche Eingaben → gleiche Ausgabe (deterministisch).
 */
export function normalizeDocumentNames(input: NormalizeDocumentNameInput): {
  machine_name: string;
  display_name: string;
} {
  const categoryLabel = mapCategory(input.documentType);
  const sender = senderSegment(input.sender);
  const combinedForDate = [
    (input.summary ?? "").trim(),
    (input.extractedText ?? "").trim().slice(0, 2000),
  ]
    .filter(Boolean)
    .join(" ");
  const dateYmd = resolveDateYmd(input.documentDate, input.uploadDate, combinedForDate);

  const kat = toAsciiSlugPart(categoryLabel) || "Sonstiges";
  const abs = sender;
  const them = topicSegment(input.summary, input.extractedText ?? null, categoryLabel, abs);
  const dat = dateYmd;

  let machine = collapseUnderscores([kat, abs, them, dat].join("_"));
  if (machine.length > MAX_MACHINE_LEN) {
    machine = machine.slice(0, MAX_MACHINE_LEN).replace(/_+$/g, "");
  }

  const display = machine
    .split("_")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const fallbackMachine = "Sonstiges_Unbekannt_Mitteilung_" + uploadDateYmd(input.uploadDate);
  return {
    machine_name: machine || fallbackMachine,
    display_name: display || fallbackMachine.replace(/_/g, " "),
  };
}
