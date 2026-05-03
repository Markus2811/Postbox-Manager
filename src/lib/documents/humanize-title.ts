const DE_DATE_TAIL = /\s+(\d{1,2}\.\d{1,2}\.\d{4})\s*$/;

/**
 * Zeigt einen kurzen, lesbaren Titel – bevorzugt KI-Anzeigename, sonst bereinigter Dateiname.
 * Unterstriche und Mehrfach-Leerzeichen werden immer bereinigt.
 * Ein angehängtes Datum (DD.MM.YYYY) bleibt bei Kürzung erhalten (einheitliche Namenskonvention).
 */
export function humanizeDocumentTitle(
  displayName: string | null | undefined,
  originalFilename: string | null | undefined
): string {
  const raw = (displayName?.trim() || originalFilename?.trim() || "Dokument").trim();
  let s = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^\d{4}-\d{2}-\d{2}\s*/g, "");
  s = s.replace(/\s+/g, " ").trim();

  const maxLen = 72;
  if (s.length <= maxLen) return s;

  const dateMatch = s.match(DE_DATE_TAIL);
  const dateSuffix = dateMatch ? dateMatch[1] : null;
  const dateSpan = dateMatch ? dateMatch[0] : "";
  const body = dateSuffix ? s.slice(0, s.length - dateSpan.length).trim() : s;

  if (dateSuffix) {
    const room = maxLen - dateSuffix.length - 1;
    if (room >= 12) {
      const clipped =
        body.length > room ? `${body.slice(0, Math.max(0, room - 1)).trimEnd()}…` : body;
      return `${clipped} ${dateSuffix}`.replace(/\s+/g, " ").trim();
    }
  }

  const parts = body.split(/[\s–—]+/).filter(Boolean);
  if (parts.length >= 3) {
    const head = parts.slice(0, 3).join(" ");
    const withDate = dateSuffix ? `${head} ${dateSuffix}` : head;
    if (withDate.length <= maxLen) return withDate;
  }

  const cap = dateSuffix ? maxLen - dateSuffix.length - 2 : maxLen - 1;
  const base = body.length > cap ? `${body.slice(0, Math.max(12, cap)).trimEnd()}…` : body;
  return dateSuffix ? `${base} ${dateSuffix}`.replace(/\s+/g, " ").trim() : base;
}
