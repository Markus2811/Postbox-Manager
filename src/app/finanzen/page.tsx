import { AppPageLayout } from "@/components/app-page-layout";
import {
  ViewDocCard,
  ViewEmpty,
  ViewSection,
} from "@/components/views/view-doc-card";
import { formatCurrency, todayYmd } from "@/lib/documents/format";
import { sortByDueAsc } from "@/lib/documents/metadata-helpers";
import { getDocumentsWithMetadata } from "@/lib/documents/queries";
import type { DocumentWithMetadata } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

function monthKey(doc: DocumentWithMetadata): string | null {
  const m = doc.document_metadata;
  const raw = m?.document_date ?? m?.due_date ?? doc.created_at.slice(0, 10);
  return raw ? raw.slice(0, 7) : null;
}

export default async function FinanzenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const docs = await getDocumentsWithMetadata(supabase, user.id);
  const withAmount = docs.filter(
    (d) => d.document_metadata?.amount != null && !Number.isNaN(Number(d.document_metadata?.amount))
  );

  const byMonth = new Map<string, number>();
  for (const d of withAmount) {
    const k = monthKey(d);
    if (!k) continue;
    const a = Number(d.document_metadata?.amount ?? 0);
    byMonth.set(k, (byMonth.get(k) ?? 0) + a);
  }
  const monthRows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const today = todayYmd();
  const upcoming = sortByDueAsc(
    withAmount.filter((d) => d.document_metadata?.due_date)
  ).filter((d) => {
    const y = d.document_metadata?.due_date?.slice(0, 10);
    return y && y >= today;
  });

  const amountNoDue = withAmount.filter((d) => !d.document_metadata?.due_date);

  const bySender = new Map<string, { sum: number; n: number }>();
  for (const d of withAmount) {
    const s = d.document_metadata?.sender?.trim() || "Unbekannt";
    const a = Number(d.document_metadata?.amount ?? 0);
    const cur = bySender.get(s) ?? { sum: 0, n: 0 };
    cur.sum += a;
    cur.n += 1;
    bySender.set(s, cur);
  }
  const senderRows = [...bySender.entries()].sort((a, b) => b[1].sum - a[1].sum);

  const byType = new Map<string, number>();
  for (const d of withAmount) {
    const t = d.document_metadata?.document_type ?? "other";
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const typeRows = [...byType.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <AppPageLayout
      title="Finanzen"
      description="Einfacher Überblick aus erkannten Beträgen in deinen Dokumenten – keine Buchhaltung, keine Bank-Anbindung."
    >
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="underline-offset-2 hover:underline">
          ← Dashboard
        </Link>
      </p>

      <ViewSection title="Summen nach Monat (nach Dokument- bzw. Fristdatum)">
        {monthRows.length === 0 ? (
          <ViewEmpty message="Noch keine Dokumente mit erkanntem Betrag." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Monat</th>
                  <th className="px-4 py-2 text-right">Summe (EUR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {monthRows.map(([k, sum]) => (
                  <tr key={k}>
                    <td className="px-4 py-2">{k}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(sum, "EUR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ViewSection>

      <ViewSection title="Anstehende Zahlungen (mit Betrag und Frist)">
        {upcoming.length === 0 ? (
          <ViewEmpty message="Keine offenen Posten mit Betrag und Frist." />
        ) : (
          upcoming.map((d) => <ViewDocCard key={d.id} doc={d} />)
        )}
      </ViewSection>

      <ViewSection title="Betrag ohne Fristdatum">
        {amountNoDue.length === 0 ? (
          <ViewEmpty message="Alle Beträge haben ein Fristdatum – oder es gibt keine Beträge." />
        ) : (
          amountNoDue.map((d) => <ViewDocCard key={d.id} doc={d} />)
        )}
      </ViewSection>

      <ViewSection title="Nach Absender (Summe)">
        {senderRows.length === 0 ? (
          <ViewEmpty message="Keine Daten." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Absender</th>
                  <th className="px-4 py-2 text-right">Anzahl</th>
                  <th className="px-4 py-2 text-right">Summe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {senderRows.map(([name, { sum, n }]) => (
                  <tr key={name}>
                    <td className="px-4 py-2">{name}</td>
                    <td className="px-4 py-2 text-right">{n}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(sum, "EUR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ViewSection>

      <ViewSection title="Nach Dokumenttyp (Anzahl mit Betrag)">
        {typeRows.length === 0 ? (
          <ViewEmpty message="Keine Typen." />
        ) : (
          <ul className="space-y-1 rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
            {typeRows.map(([t, n]) => (
              <li key={t} className="flex justify-between">
                <span className="text-zinc-700">{t}</span>
                <span className="text-zinc-500">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </ViewSection>
    </AppPageLayout>
  );
}
