import { AppPageLayout } from "@/components/app-page-layout";
import {
  ViewDocCard,
  ViewEmpty,
  ViewSection,
} from "@/components/views/view-doc-card";
import { addDaysToYmd, todayYmd } from "@/lib/documents/format";
import { sortByDueAsc } from "@/lib/documents/metadata-helpers";
import { getDocumentsWithMetadata } from "@/lib/documents/queries";
import type { DocumentWithMetadata } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

function dueYmd(doc: DocumentWithMetadata): string | null {
  const d = doc.document_metadata?.due_date;
  return d ? d.slice(0, 10) : null;
}

export default async function FristenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const docs = await getDocumentsWithMetadata(supabase, user.id);
  const today = todayYmd();
  const end7 = addDaysToYmd(today, 7);
  const end30 = addDaysToYmd(today, 30);

  const heute = sortByDueAsc(
    docs.filter((d) => {
      const y = dueYmd(d);
      return y !== null && y === today;
    })
  );

  const naechste7 = sortByDueAsc(
    docs.filter((d) => {
      const y = dueYmd(d);
      return y !== null && y > today && y <= end7;
    })
  );

  const naechste30 = sortByDueAsc(
    docs.filter((d) => {
      const y = dueYmd(d);
      return y !== null && y > end7 && y <= end30;
    })
  );

  const ohneFristHandlung = sortByDueAsc(
    docs.filter((d) => {
      const m = d.document_metadata;
      return !m?.due_date && m?.action_required;
    })
  );

  return (
    <AppPageLayout
      title="Fristen & To-dos"
      description="Überblick nach Dringlichkeit: heute fällig, kommende Wochen, und Post ohne Datum aber mit Handlungsbedarf."
    >
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="underline-offset-2 hover:underline">
          ← Dashboard
        </Link>
      </p>

      <FristBlock title="Heute fällig" docs={heute} empty="Nichts für heute vorgemerkt." />
      <FristBlock
        title="Nächste 7 Tage"
        docs={naechste7}
        empty="Keine Fristen in den nächsten sieben Tagen."
      />
      <FristBlock
        title="Nächste 30 Tage"
        docs={naechste30}
        empty="Keine weiteren Fristen im 30-Tage-Fenster."
      />
      <FristBlock
        title="Ohne Frist, aber Handlung nötig"
        docs={ohneFristHandlung}
        empty="Keine offenen Punkte ohne Datum."
      />
    </AppPageLayout>
  );
}

function FristBlock({
  title,
  docs,
  empty,
}: {
  title: string;
  docs: DocumentWithMetadata[];
  empty: string;
}) {
  return (
    <ViewSection title={title}>
      {docs.length === 0 ? (
        <ViewEmpty message={empty} />
      ) : (
        docs.map((d) => <ViewDocCard key={d.id} doc={d} />)
      )}
    </ViewSection>
  );
}
