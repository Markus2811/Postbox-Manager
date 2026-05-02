export const UI_CATEGORIES = [
  "Rechnungen",
  "Verträge",
  "Versicherungen",
  "Bank & Finanzen",
  "Steuern",
  "Gesundheit",
  "Behörden",
  "Sonstiges",
] as const;

export type UiCategory = (typeof UI_CATEGORIES)[number];

export const DOCUMENT_TYPES = [
  "invoice",
  "contract",
  "insurance",
  "bank",
  "tax",
  "medical",
  "government",
  "other",
] as const;

export type DocumentTypeKey = (typeof DOCUMENT_TYPES)[number];

export function categoryFromDocumentType(
  documentType: string | null | undefined
): UiCategory {
  const t = (documentType ?? "other").toLowerCase() as DocumentTypeKey;
  switch (t) {
    case "invoice":
      return "Rechnungen";
    case "contract":
      return "Verträge";
    case "insurance":
      return "Versicherungen";
    case "bank":
      return "Bank & Finanzen";
    case "tax":
      return "Steuern";
    case "medical":
      return "Gesundheit";
    case "government":
      return "Behörden";
    default:
      return "Sonstiges";
  }
}

/** Kurzes deutsches Label für Dateinamen (ASCII-lastig). */
export function typeLabelForFilename(documentType: string | null | undefined): string {
  const t = (documentType ?? "other").toLowerCase() as DocumentTypeKey;
  const map: Record<DocumentTypeKey, string> = {
    invoice: "Rechnung",
    contract: "Vertrag",
    insurance: "Versicherung",
    bank: "Bank",
    tax: "Steuer",
    medical: "Gesundheit",
    government: "Behoerde",
    other: "Dokument",
  };
  return map[t] ?? "Dokument";
}

/** Lesbares deutsches Label für UI (z. B. Tabellen, Analytics). */
export function documentTypeUiLabel(documentType: string | null | undefined): string {
  const t = (documentType ?? "other").toLowerCase() as DocumentTypeKey;
  const map: Record<DocumentTypeKey, string> = {
    invoice: "Rechnung",
    contract: "Vertrag / Abo",
    insurance: "Versicherung",
    bank: "Bank / Finanz",
    tax: "Steuer",
    medical: "Gesundheit",
    government: "Behörde / Amt",
    other: "Sonstiges",
  };
  return map[t] ?? (documentType?.trim() ? documentType : "Unbekannt");
}
