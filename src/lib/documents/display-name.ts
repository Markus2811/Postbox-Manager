import { normalizeDocumentNames, type NormalizeDocumentNameInput } from "@/lib/documents/normalize-document-name";

export type BuildDisplayNameInput = NormalizeDocumentNameInput;

/**
 * Persistierter Anzeigename (maschinenlesbar, Unterstriche) für `documents.display_name`.
 * UI: `normalizeDocumentNames(…).display_name` oder `humanizeDocumentTitle(display_name, …)`.
 */
export function buildDisplayName(input: BuildDisplayNameInput): string {
  return normalizeDocumentNames(input).machine_name;
}

export { normalizeDocumentNames } from "@/lib/documents/normalize-document-name";
