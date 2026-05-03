import {
  buildDocumentNamesFromAnalysis,
  type BuildDocumentNamesFromAnalysisInput,
} from "@/lib/documents/document-naming";

export type BuildDisplayNameInput = BuildDocumentNamesFromAnalysisInput;

/**
 * User-facing title for `documents.display_name` (human-readable, no underscores).
 */
export function buildDisplayName(input: BuildDisplayNameInput): string {
  return buildDocumentNamesFromAnalysis(input).display_name;
}

export function buildMachineName(input: BuildDisplayNameInput): string {
  return buildDocumentNamesFromAnalysis(input).machine_name;
}

export {
  buildDocumentNamesFromAnalysis,
  cleanSender,
  cleanTopic,
  generateDocumentNames,
  looksLikeMachineTitle,
  normalizeCategory,
} from "@/lib/documents/document-naming";
export { normalizeDocumentNames } from "@/lib/documents/normalize-document-name";
