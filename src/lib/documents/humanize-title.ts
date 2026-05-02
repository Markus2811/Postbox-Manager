/**
 * Zeigt einen kurzen, lesbaren Titel – bevorzugt KI-Anzeigename, sonst bereinigter Dateiname.
 */
export function humanizeDocumentTitle(
  displayName: string | null | undefined,
  originalFilename: string | null | undefined
): string {
  const raw = (displayName?.trim() || originalFilename?.trim() || "Dokument").trim();
  if (raw.length <= 72) return raw;

  let s = raw.replace(/_/g, " ");
  s = s.replace(/^\d{4}-\d{2}-\d{2}\s*/g, "");
  s = s.replace(/\s+/g, " ").trim();

  const parts = s.split(/[\s–—|-]+/).filter(Boolean);
  if (parts.length >= 3) {
    const head = parts.slice(0, 3).join(" ");
    if (head.length <= 64) return head;
  }

  if (s.length > 64) return `${s.slice(0, 61)}…`;
  return s;
}
