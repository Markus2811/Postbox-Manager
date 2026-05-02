/** Lokales Kalenderdatum YYYY-MM-DD (für Vergleiche mit DB-Datum). */
export function todayYmd(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO-Datum YYYY-MM-DD um n Tage verschieben (lokal). */
export function addDaysToYmd(ymd: string, days: number): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + days);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Kalenderwoche Mo–So (lokal) für ein beliebiges Referenzdatum YYYY-MM-DD. */
export function calendarWeekRangeMonSun(ymd: string): { start: string; end: string } {
  const [y, mo, da] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setHours(0, 0, 0, 0);
  const dow = dt.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(dt);
  mon.setDate(dt.getDate() + toMonday);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: ymdFromLocalDate(mon), end: ymdFromLocalDate(sun) };
}

/** YYYY-MM-DD lexikografischer Vergleich: -1 / 0 / 1. */
export function compareYmd(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(`${iso}T12:00:00`)
      : new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined
): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  const cur = currency && currency.length === 3 ? currency : "EUR";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: cur,
    }).format(Number(amount));
  } catch {
    return `${amount} ${cur}`;
  }
}
