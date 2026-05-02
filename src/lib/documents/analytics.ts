import { documentTypeUiLabel } from "@/lib/documents/categories";
import {
  calendarWeekRangeMonSun,
  compareYmd,
  formatDate,
  todayYmd,
} from "@/lib/documents/format";
import { isDeadlineWithinDays } from "@/lib/documents/metadata-helpers";
import type { DocumentWithMetadata } from "@/lib/documents/types";

export type DocumentTypeBreakdown = {
  typeKey: string;
  label: string;
  count: number;
  sharePercent: number;
  sumAmount: number;
  withAmountCount: number;
  actionRequiredCount: number;
  avgConfidencePercent: number | null;
};

export type CategoryBreakdown = {
  category: string;
  count: number;
  sharePercent: number;
  sumAmount: number;
  withAmountCount: number;
  actionRequiredCount: number;
};

export type DocumentAnalytics = {
  total: number;
  byStatus: { status: string; count: number }[];
  byDocumentType: DocumentTypeBreakdown[];
  byCategory: CategoryBreakdown[];
  withoutMetadata: number;
  actionRequired: number;
  deadlinesNext30Days: number;
  failedCount: number;
  processingCount: number;
  avgConfidencePercent: number | null;
  insights: string[];
  /** Bis zu 3 Dokumente mit nächster Frist / Handlung (sortiert nach Frist). */
  topDeadlineTodos: DocumentWithMetadata[];
  /** Fälligkeiten in der aktuellen Kalenderwoche (Mo–So, lokal). */
  thisWeekDeadlineDocs: DocumentWithMetadata[];
  calendarWeekStart: string;
  calendarWeekEnd: string;
  calendarWeekLabel: string;
  overdueCount: number;
  dueThisWeekCount: number;
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Nur Kalendertag YYYY-MM-DD aus ISO-String. */
function sliceDueYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function sortTopTodos(docs: DocumentWithMetadata[]): DocumentWithMetadata[] {
  return [...docs].sort((a, b) => {
    const ya = sliceDueYmd(a.document_metadata?.due_date ?? null);
    const yb = sliceDueYmd(b.document_metadata?.due_date ?? null);
    const c = compareYmd(ya, yb);
    if (c !== 0) return c;
    const ar = a.document_metadata?.action_required ? 1 : 0;
    const br = b.document_metadata?.action_required ? 1 : 0;
    return br - ar;
  });
}

export function computeDocumentAnalytics(
  docs: DocumentWithMetadata[]
): DocumentAnalytics {
  const total = docs.length;
  const withoutMetadata = docs.filter((d) => !d.document_metadata).length;

  const statusMap = new Map<string, number>();
  for (const d of docs) {
    statusMap.set(d.status, (statusMap.get(d.status) ?? 0) + 1);
  }
  const byStatus = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  type TypeAgg = {
    count: number;
    sumAmount: number;
    withAmount: number;
    actionRequired: number;
    confidences: number[];
  };
  const typeAgg = new Map<string, TypeAgg>();

  for (const d of docs) {
    const m = d.document_metadata;
    const key = (m?.document_type ?? "other").toLowerCase();
    const cur: TypeAgg = typeAgg.get(key) ?? {
      count: 0,
      sumAmount: 0,
      withAmount: 0,
      actionRequired: 0,
      confidences: [],
    };

    cur.count += 1;
    const amt = num(m?.amount);
    if (amt != null) {
      cur.sumAmount += amt;
      cur.withAmount += 1;
    }
    if (m?.action_required) cur.actionRequired += 1;
    const c = num(m?.confidence);
    if (c != null && c >= 0 && c <= 1) cur.confidences.push(c);

    typeAgg.set(key, cur);
  }

  const byDocumentType: DocumentTypeBreakdown[] = [...typeAgg.entries()]
    .map(([typeKey, v]) => {
      const avgConf =
        v.confidences.length > 0
          ? Math.round(
              (v.confidences.reduce((a, b) => a + b, 0) / v.confidences.length) * 100
            )
          : null;
      return {
        typeKey,
        label: documentTypeUiLabel(typeKey),
        count: v.count,
        sharePercent: total > 0 ? Math.round((v.count / total) * 1000) / 10 : 0,
        sumAmount: v.sumAmount,
        withAmountCount: v.withAmount,
        actionRequiredCount: v.actionRequired,
        avgConfidencePercent: avgConf,
      };
    })
    .sort((a, b) => b.count - a.count);

  type CatAgg = { count: number; sumAmount: number; withAmount: number; actionRequired: number };
  const catMap = new Map<string, CatAgg>();
  for (const d of docs) {
    const c = d.category?.trim() || "Ohne Kategorie";
    const cur = catMap.get(c) ?? {
      count: 0,
      sumAmount: 0,
      withAmount: 0,
      actionRequired: 0,
    };
    cur.count += 1;
    const amt = num(d.document_metadata?.amount);
    if (amt != null) {
      cur.sumAmount += amt;
      cur.withAmount += 1;
    }
    if (d.document_metadata?.action_required) cur.actionRequired += 1;
    catMap.set(c, cur);
  }
  const byCategory: CategoryBreakdown[] = [...catMap.entries()]
    .map(([category, v]) => ({
      category,
      count: v.count,
      sharePercent: total > 0 ? Math.round((v.count / total) * 1000) / 10 : 0,
      sumAmount: v.sumAmount,
      withAmountCount: v.withAmount,
      actionRequiredCount: v.actionRequired,
    }))
    .sort((a, b) => b.count - a.count);

  let actionRequired = 0;
  let deadlinesNext30Days = 0;
  const allConf: number[] = [];
  const today = todayYmd();
  const { start: weekStart, end: weekEnd } = calendarWeekRangeMonSun(today);
  const calendarWeekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  const todoCandidates = docs.filter((d) => {
    const m = d.document_metadata;
    return Boolean(m?.due_date || m?.action_required);
  });
  const topDeadlineTodos = sortTopTodos(todoCandidates).slice(0, 3);

  const thisWeekDeadlineDocs = sortTopTodos(
    docs.filter((d) => {
      const y = sliceDueYmd(d.document_metadata?.due_date ?? null);
      if (!y) return false;
      return compareYmd(y, weekStart) >= 0 && compareYmd(y, weekEnd) <= 0;
    })
  );

  let overdueCount = 0;
  for (const d of docs) {
    const y = sliceDueYmd(d.document_metadata?.due_date ?? null);
    if (y && compareYmd(y, today) < 0) overdueCount += 1;
  }
  const dueThisWeekCount = thisWeekDeadlineDocs.length;

  for (const d of docs) {
    const m = d.document_metadata;
    if (m?.action_required) actionRequired += 1;
    if (m?.due_date && isDeadlineWithinDays(m.due_date, 30)) deadlinesNext30Days += 1;
    const c = num(m?.confidence);
    if (c != null && c >= 0 && c <= 1) allConf.push(c);
  }

  const failedCount = statusMap.get("failed") ?? 0;
  const processingCount = statusMap.get("processing") ?? 0;

  const avgConfidencePercent =
    allConf.length > 0
      ? Math.round((allConf.reduce((a, b) => a + b, 0) / allConf.length) * 100)
      : null;

  const insights: string[] = [];
  if (total === 0) {
    insights.push("Noch keine Dokumente – nach dem ersten Upload erscheinen hier Auswertungen.");
  } else {
    const processed = statusMap.get("processed") ?? 0;
    const pctProcessed = Math.round((processed / total) * 100);
    insights.push(
      `${pctProcessed} % der Dokumente sind als „verarbeitet“ markiert (${processed} von ${total}).`
    );

    if (withoutMetadata > 0) {
      insights.push(
        `${withoutMetadata} Dokument(e) ohne Analyse-Metadaten – Upload abschließen oder Analyse erneut starten.`
      );
    }
    if (failedCount > 0) {
      insights.push(
        `${failedCount} Analyse(n) fehlgeschlagen – in der Detailansicht erneut versuchen.`
      );
    }
    if (processingCount > 0) {
      insights.push(`${processingCount} Dokument(e) werden gerade analysiert.`);
    }
    if (byDocumentType.length > 0) {
      const top = byDocumentType[0];
      insights.push(
        `Häufigster Dokumenttyp: „${top.label}“ (${top.count} · ${top.sharePercent} %).`
      );
    }
    if (actionRequired > 0) {
      insights.push(
        `Bei ${actionRequired} Dokument(en) wurde eine Handlung oder Frist hervorgehoben.`
      );
    }
    if (deadlinesNext30Days > 0) {
      insights.push(`${deadlinesNext30Days} Frist(en) in den nächsten 30 Tagen (laut Metadaten).`);
    }
    if (overdueCount > 0) {
      insights.push(`${overdueCount} Dokument(e) mit Fristdatum in der Vergangenheit – bitte prüfen.`);
    }
    if (dueThisWeekCount > 0) {
      insights.push(
        `In dieser Kalenderwoche (${calendarWeekLabel}) sind ${dueThisWeekCount} Frist(en) fällig.`
      );
    }
    if (avgConfidencePercent != null && processed > 0) {
      insights.push(
        `Durchschnittliche Modell-Sicherheit bei ausgewerteten Dokumenten: ca. ${avgConfidencePercent} %.`
      );
    }
  }

  return {
    total,
    byStatus,
    byDocumentType,
    byCategory,
    withoutMetadata,
    actionRequired,
    deadlinesNext30Days,
    failedCount,
    processingCount,
    avgConfidencePercent,
    insights,
    topDeadlineTodos,
    thisWeekDeadlineDocs,
    calendarWeekStart: weekStart,
    calendarWeekEnd: weekEnd,
    calendarWeekLabel,
    overdueCount,
    dueThisWeekCount,
  };
}
