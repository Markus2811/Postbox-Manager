import type { DocumentListRowRaw } from "@/lib/documents/list-documents";
import { workspaceOf } from "@/lib/documents/dashboard-metrics";

export type TaskUrgency = "critical" | "high" | "medium" | "low";

export type DashboardTaskItem = {
  documentId: string;
  title: string;
  href: string;
  urgency: TaskUrgency;
  urgencyLabel: string;
  explanation: string;
  dueLabel: string | null;
  tier: number;
  daysFromDue: number | null;
};

function meta(d: DocumentListRowRaw) {
  const m = d.document_metadata;
  if (!m) return null;
  return Array.isArray(m) ? (m[0] ?? null) : m;
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Kalendertage bis zur Frist: negativ = überfällig, 0 = heute, null = keine Frist. */
export function daysFromDueDate(due: string | null | undefined): number | null {
  if (!due) return null;
  const m = due.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  const start = todayStart();
  return Math.round((t.getTime() - start.getTime()) / 86_400_000);
}

function formatDueDe(due: string | null | undefined): string | null {
  if (!due) return null;
  const m = due.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function docTitle(d: DocumentListRowRaw): string {
  return (d.display_name ?? d.original_filename).trim() || d.original_filename;
}

function isInvoiceLike(m: NonNullable<ReturnType<typeof meta>>): boolean {
  const t = (m.document_type ?? "").toLowerCase();
  return t === "invoice" || t === "tax" || t === "bank";
}

function defaultInstruction(
  m: NonNullable<ReturnType<typeof meta>>,
  ctx: { overdue: boolean; days: number | null }
): string {
  const explicit = m.action_description?.trim();
  if (explicit) return explicit;

  if (ctx.overdue) {
    if (isInvoiceLike(m)) {
      return "Zahlungs- oder Widerspruchsfrist ist vorbei. Bitte begleichen, widersprechen oder den Rechnungssteller kontaktieren.";
    }
    return "Die angegebene Frist ist überschritten. Bitte das Dokument prüfen und die offene Aufgabe zeitnah erledigen.";
  }

  if (m.action_required) {
    return "Handlungsbedarf ist markiert. Bitte Dokument öffnen und die nächsten Schritte aus dem Inhalt ableiten.";
  }

  if (ctx.days === 0) {
    return "Frist endet heute. Bitte rechtzeitig reagieren (z. B. zahlen, bestätigen oder verlängern).";
  }

  if (ctx.days != null && ctx.days > 0 && ctx.days <= 7) {
    return "Frist naht innerhalb einer Woche. Termin einplanen und Dokument bearbeiten.";
  }

  return "Fälligkeit innerhalb von 30 Tagen. Jetzt vormerken oder vorbereiten, damit nichts liegen bleibt.";
}

function urgencyForTier(tier: number): TaskUrgency {
  if (tier <= 1) return "critical";
  if (tier <= 3) return "high";
  if (tier <= 5) return "medium";
  return "low";
}

function urgencyLabelDe(tier: number, overdue: boolean, days: number | null): string {
  if (overdue) return "Überfällig";
  if (days === 0) return "Heute fällig";
  if (days != null && days > 0 && days <= 7) return "Frist in ≤ 7 Tagen";
  if (tier === 4) return "Handlung nötig";
  if (days != null && days <= 30) return "Frist in ≤ 30 Tagen";
  return "Vormerken";
}

function taskTier(
  m: NonNullable<ReturnType<typeof meta>>,
  days: number | null
): number | null {
  const overdue = days !== null && days < 0;
  const in30 = days !== null && days <= 30;
  const in7 = days !== null && days >= 0 && days <= 7;

  if (!m.action_required && !overdue && !in30) return null;

  if (overdue && m.action_required) return 0;
  if (overdue) return 1;
  if (m.action_required && in7) return 2;
  if (days === 0) return 3;
  if (m.action_required) return 4;
  if (in7) return 5;
  if (in30) return 6;
  return null;
}

export const MAX_DASHBOARD_PRIORITY_TASKS = 24;

/**
 * Alle priorisierten Aufgaben (gleiche Regeln wie die Dashboard-Liste), sortiert.
 */
export function collectDashboardTasks(docs: DocumentListRowRaw[]): DashboardTaskItem[] {
  const items: DashboardTaskItem[] = [];

  for (const d of docs) {
    if (workspaceOf(d) === "done") continue;
    const m = meta(d);
    if (!m) continue;
    const days = daysFromDueDate(m.due_date ?? null);
    const tier = taskTier(m, days);
    if (tier === null) continue;

    const overdue = days !== null && days < 0;
    const dueFormatted = formatDueDe(m.due_date ?? null);
    const dueLabel =
      dueFormatted == null
        ? null
        : overdue
          ? `Frist war am ${dueFormatted}`
          : days === 0
            ? `Frist: heute (${dueFormatted})`
            : days != null && days > 0
              ? `Frist: ${dueFormatted} (in ${days} Tag${days === 1 ? "" : "en"})`
              : `Frist: ${dueFormatted}`;

    items.push({
      documentId: d.id,
      title: docTitle(d),
      href: `/dashboard?focus=${encodeURIComponent(d.id)}`,
      tier,
      daysFromDue: days,
      urgency: urgencyForTier(tier),
      urgencyLabel: urgencyLabelDe(tier, overdue, days),
      explanation: defaultInstruction(m, { overdue, days }),
      dueLabel,
    });
  }

  items.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const da = a.daysFromDue ?? 99_999;
    const db = b.daysFromDue ?? 99_999;
    return da - db;
  });

  return items;
}

export function countPriorityQueue(docs: DocumentListRowRaw[]): number {
  return collectDashboardTasks(docs).length;
}

/**
 * Kurzliste fürs Dashboard (oberste Einträge nach Dringlichkeit).
 */
export function buildDashboardTasks(docs: DocumentListRowRaw[]): DashboardTaskItem[] {
  return collectDashboardTasks(docs).slice(0, MAX_DASHBOARD_PRIORITY_TASKS);
}
