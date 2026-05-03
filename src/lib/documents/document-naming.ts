/**
 * Deterministic document naming: machine_name [Kategorie]_[Absender]_[Thema]_[Datum],
 * display_name for UI ("Thema – … DD.MM.YYYY" / "Kategorie – …").
 */

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
    "information",
    "informations",
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
    "dies",
    "ist",
    "sind",
    "war",
    "waren",
    "this",
    "that",
    "the",
    "for",
    "not",
    "rechnung",
    "steuer",
    "steuerbescheid",
    "vertrag",
    "versicherung",
  ].map((w) => w.toLowerCase())
);

const MAX_MACHINE_LEN = 80;
const TOPIC_MAX_WORDS = 5;
const SENDER_MAX_WORDS = 2;

export type GenerateDocumentNamesInput = {
  category: string;
  sender: string | null | undefined;
  topic: string;
  date: string;
};

function collapseUnderscores(s: string): string {
  return s.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export function toAsciiSlugPart(raw: string): string {
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

function titleCaseWord(w: string): string {
  if (!w) return w;
  if (w.length === 1) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function stripLegalEntity(name: string): string {
  let s = name.trim().replace(LEGAL_SUFFIX, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Removes legal suffixes, trims, keeps at most two words (plaintext).
 */
export function cleanSender(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "Unbekannt";
  const cleaned = stripLegalEntity(raw);
  const words = cleaned
    .split(/[\s,;/|]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, SENDER_MAX_WORDS);
  if (words.length === 0) return "Unbekannt";
  return words.join(" ");
}

function senderMachineSegment(senderPlain: string): string {
  if (senderPlain === "Unbekannt") return "Unbekannt";
  const words = senderPlain.split(/\s+/).filter(Boolean).slice(0, SENDER_MAX_WORDS);
  const slug = words
    .map((w) => toAsciiSlugPart(w))
    .filter(Boolean)
    .join("_");
  return collapseUnderscores(slug) || "Unbekannt";
}

function categoryLower(cat: string): string {
  return cat.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
}

/**
 * Maps UI category, English type key, or German label to canonical display category.
 */
export function normalizeCategory(category: string): string {
  const raw = category.trim();
  if (!raw) return "Sonstiges";
  const key = raw.toLowerCase().replace(/\s+/g, " ").replace(/&/g, " ");

  const map: Record<string, string> = {
    rechnungen: "Rechnung",
    rechnung: "Rechnung",
    invoice: "Rechnung",
    steuern: "Steuer",
    steuer: "Steuer",
    tax: "Steuer",
    verträge: "Vertrag",
    vertraege: "Vertrag",
    vertrag: "Vertrag",
    contract: "Vertrag",
    versicherungen: "Versicherung",
    versicherung: "Versicherung",
    insurance: "Versicherung",
    bank: "Bank",
    "bank & finanzen": "Bank",
    "bank und finanzen": "Bank",
    finanzen: "Bank",
    gesundheit: "Gesundheit",
    medical: "Gesundheit",
    behörden: "Behörde",
    behoerden: "Behörde",
    behörde: "Behörde",
    behoerde: "Behörde",
    government: "Behörde",
    sonstiges: "Sonstiges",
    other: "Sonstiges",
    dokument: "Sonstiges",
  };

  if (map[key]) return map[key];

  const compact = key.replace(/[^a-z0-9äöü]/gi, "");
  for (const [k, v] of Object.entries(map)) {
    if (k.replace(/\s+/g, "") === compact) return v;
  }

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function categoryMachinePrefix(displayCategory: string): string {
  const slug = toAsciiSlugPart(displayCategory);
  return collapseUnderscores(slug) || "Sonstiges";
}

/**
 * Extracts 3–5 meaningful topic tokens; removes filler words.
 */
export function cleanTopic(
  text: string,
  options: { categoryDisplay: string; senderMachine: string }
): string[] {
  const combined = (text ?? "").trim();
  if (!combined) return ["Mitteilung"];

  const catLc = categoryLower(options.categoryDisplay);
  const senderTokens = new Set(
    options.senderMachine
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
    out.push(titleCaseWord(raw));
    if (out.length >= TOPIC_MAX_WORDS) break;
  }

  if (out.length === 0) return ["Mitteilung"];
  return out;
}

function topicMachineSegment(wordsDisplay: string[]): string {
  const slug = wordsDisplay
    .map((w) => toAsciiSlugPart(w))
    .filter(Boolean)
    .join("_");
  return collapseUnderscores(slug) || "Mitteilung";
}

function formatDeDate(ymd: string): string {
  if (!ISO_DATE.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function buildDisplayNameLine(
  categoryDisplay: string,
  senderMachine: string,
  topicWords: string[],
  dateYmd: string
): string {
  const de = formatDeDate(dateYmd);
  const isSonstigesUnknown = categoryDisplay === "Sonstiges" && senderMachine === "Unbekannt";

  if (isSonstigesUnknown) {
    if (topicWords.length >= 2) {
      return `${topicWords[0]} – ${topicWords.slice(1).join(" ")} ${de}`.replace(/\s+/g, " ").trim();
    }
    return `${topicWords.join(" ")} ${de}`.replace(/\s+/g, " ").trim();
  }

  return `${categoryDisplay} – ${topicWords.join(" ")} ${de}`.replace(/\s+/g, " ").trim();
}

/**
 * Same inputs → same outputs. No randomness. Max machine length ~80; only `_` as special char.
 */
export function generateDocumentNames(input: GenerateDocumentNamesInput): {
  machine_name: string;
  display_name: string;
} {
  const categoryDisplay = normalizeCategory(input.category);
  const senderPlain = cleanSender(input.sender);
  const senderMach = senderMachineSegment(senderPlain);
  const topicWords = cleanTopic(input.topic, {
    categoryDisplay,
    senderMachine: senderMach,
  });
  const them = topicMachineSegment(topicWords);
  const kat = categoryMachinePrefix(categoryDisplay);
  const dat = ISO_DATE.test(input.date) ? input.date : "";

  let machine = collapseUnderscores([kat, senderMach, them, dat].filter(Boolean).join("_"));
  if (machine.length > MAX_MACHINE_LEN) {
    machine = machine.slice(0, MAX_MACHINE_LEN).replace(/_+$/g, "");
  }

  const display_name = buildDisplayNameLine(categoryDisplay, senderMach, topicWords, dat || input.date);

  const fallbackDate = ISO_DATE.test(input.date) ? input.date : "1970-01-01";
  const fallbackMachine = collapseUnderscores(
    ["Sonstiges", "Unbekannt", "Mitteilung", fallbackDate].join("_")
  );

  return {
    machine_name: machine || fallbackMachine,
    display_name: display_name || buildDisplayNameLine("Sonstiges", "Unbekannt", ["Mitteilung"], fallbackDate),
  };
}

export type BuildDocumentNamesFromAnalysisInput = {
  documentType: string | null | undefined;
  /** UI category label e.g. "Rechnungen" — takes precedence over documentType when set */
  categoryLabel?: string | null;
  sender: string | null | undefined;
  summary: string | null | undefined;
  documentDate: string | null | undefined;
  uploadDate: Date;
  extractedText?: string | null;
};

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

/**
 * Builds both names from analysis fields (after OCR / LLM extraction).
 */
export function buildDocumentNamesFromAnalysis(input: BuildDocumentNamesFromAnalysisInput): {
  machine_name: string;
  display_name: string;
} {
  const categoryKey =
    typeof input.categoryLabel === "string" && input.categoryLabel.trim()
      ? input.categoryLabel.trim()
      : (input.documentType ?? "other");

  const combinedForTopic = [
    (input.summary ?? "").trim(),
    (input.extractedText ?? "").trim().slice(0, 2000),
  ]
    .filter(Boolean)
    .join(" ");

  const dateYmd = resolveDateYmd(input.documentDate, input.uploadDate, combinedForTopic);

  return generateDocumentNames({
    category: categoryKey,
    sender: input.sender,
    topic: combinedForTopic || (input.summary ?? "").trim(),
    date: dateYmd,
  });
}

/** True if stored title looks like a legacy machine name (underscores). */
export function looksLikeMachineTitle(title: string | null | undefined): boolean {
  const s = (title ?? "").trim();
  return s.includes("_") && /^[A-Za-z0-9_]+$/.test(s.replace(/\s/g, ""));
}
