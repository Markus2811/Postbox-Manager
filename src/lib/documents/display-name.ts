import { typeLabelForFilename } from "./categories";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizePart(raw: string, maxLen: number): string {
  const trimmed = raw.trim().slice(0, maxLen);
  const noSpecial = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return noSpecial || "Dokument";
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildDisplayName(input: {
  documentDate: string | null | undefined;
  uploadDate: Date;
  sender: string | null | undefined;
  documentType: string | null | undefined;
  summary: string | null | undefined;
}): string {
  const dateStr =
    input.documentDate && ISO_DATE.test(input.documentDate)
      ? input.documentDate
      : formatDate(input.uploadDate);

  const senderRaw = (input.sender ?? "").trim() || "Unbekannt";
  const typeRaw = typeLabelForFilename(input.documentType);

  const summaryBase = (input.summary ?? "").trim();
  const short =
    summaryBase.length > 0
      ? sanitizePart(summaryBase.replace(/\s+/g, " "), 32)
      : "Scan";

  let name = `${dateStr}_${sanitizePart(senderRaw, 24)}_${sanitizePart(typeRaw, 16)}_${short}`;

  if (name.length > 80) {
    name = name.slice(0, 80).replace(/_+$/g, "");
  }
  return name;
}
