/**
 * Zeigt einen kurzen, lesbaren Titel – bevorzugt KI-Anzeigename, sonst bereinigter Dateiname.
 * Unterstriche und Mehrfach-Leerzeichen werden immer bereinigt.
 */
export function humanizeDocumentTitle(
  displayName: string | null | undefined,
  originalFilename: string | null | undefined
): string {
  const raw = (displayName?.trim() || originalFilename?.trim() || "Dokument").trim();
  let s = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^\d{4}-\d{2}-\d{2}\s*/g, "");
  s = s.replace(/\s+/g, " ").trim();

  if (s.length <= 72) return s;

  const parts = s.split(/[\s–—|-]+/).filter(Boolean);
  if (parts.length >= 3) {
    const head = parts.slice(0, 3).join(" ");
    if (head.length <= 64) return head;
  }

  if (s.length > 64) return `${s.slice(0, 61)}…`;
  return s;
}
