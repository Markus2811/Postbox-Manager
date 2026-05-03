import type { DocumentWorkspaceBucket } from "@/lib/documents/types";

/** Reservierter Schlüssel in `document_metadata.raw_ai_json` (MVP ohne Spalte `workspace_bucket`). */
export const POSTBOX_JSON_KEY = "_postbox";

/**
 * Fallback, wenn `document_metadata.extracted_text` (Spalte) in der DB fehlt:
 * maschinenlesbarer Volltext für Fragen/UI; nicht im KI-Analyse-Schema.
 */
export const POSTBOX_EXTRACTED_TEXT_JSON_KEY = "_postbox_extracted_text";

export function workspaceFromMvpMeta(rawAi: unknown): DocumentWorkspaceBucket {
  if (!rawAi || typeof rawAi !== "object" || Array.isArray(rawAi)) return "inbox";
  const box = (rawAi as Record<string, unknown>)[POSTBOX_JSON_KEY];
  if (!box || typeof box !== "object" || Array.isArray(box)) return "inbox";
  const w = (box as Record<string, unknown>)["workspace"];
  return w === "done" ? "done" : "inbox";
}

export type MergePostboxOptions = {
  /** Nur bei `workspace === "done"`: setzt oder leert die Erledigt-Notiz (`null` = leer). */
  completionNote?: string | null;
};

export function mergePostboxWorkspaceIntoRawAiJson(
  rawAi: unknown,
  workspace: DocumentWorkspaceBucket,
  opts?: MergePostboxOptions
): Record<string, unknown> {
  const base =
    rawAi && typeof rawAi === "object" && !Array.isArray(rawAi)
      ? { ...(rawAi as Record<string, unknown>) }
      : {};
  const prev =
    base[POSTBOX_JSON_KEY] &&
    typeof base[POSTBOX_JSON_KEY] === "object" &&
    !Array.isArray(base[POSTBOX_JSON_KEY])
      ? { ...(base[POSTBOX_JSON_KEY] as Record<string, unknown>) }
      : {};
  const nextBox: Record<string, unknown> = {
    ...prev,
    workspace,
    updated_at: new Date().toISOString(),
  };
  if (workspace === "inbox") {
    nextBox.completion_note = null;
  } else if (opts && opts.completionNote !== undefined) {
    const v = opts.completionNote;
    nextBox.completion_note = v != null && String(v).trim() ? String(v).trim() : null;
  }
  base[POSTBOX_JSON_KEY] = nextBox;
  return base;
}

/** Nutzer-Notiz beim Erledigen (liegt in `raw_ai_json._postbox`). */
export function completionNoteFromRawAi(rawAi: unknown): string | null {
  if (!rawAi || typeof rawAi !== "object" || Array.isArray(rawAi)) return null;
  const box = (rawAi as Record<string, unknown>)[POSTBOX_JSON_KEY];
  if (!box || typeof box !== "object" || Array.isArray(box)) return null;
  const n = (box as Record<string, unknown>)["completion_note"];
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

/** Einheitliche Ablage: Spalte `workspace_bucket` hat Vorrang, sonst MVP in `raw_ai_json`. */
export function effectiveDocumentWorkspace(input: {
  workspace_bucket?: string | null;
  document_metadata?: unknown;
}): DocumentWorkspaceBucket {
  if (input.workspace_bucket === "done") return "done";
  if (input.workspace_bucket === "inbox") return "inbox";
  const meta = input.document_metadata;
  const m = Array.isArray(meta) ? (meta[0] ?? null) : meta;
  const raw =
    m && typeof m === "object" && m !== null && "raw_ai_json" in m
      ? (m as { raw_ai_json?: unknown }).raw_ai_json
      : null;
  return workspaceFromMvpMeta(raw);
}
