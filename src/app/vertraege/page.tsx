import { AppPageLayout } from "@/components/app-page-layout";
import {
  ViewDocCard,
  ViewEmpty,
  ViewSection,
} from "@/components/views/view-doc-card";
import { hasKündigungHint, isContractLike, sortByDueAsc } from "@/lib/documents/metadata-helpers";
import { getDocumentsWithMetadata } from "@/lib/documents/queries";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function VertraegePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const docs = await getDocumentsWithMetadata(supabase, user.id);
  const contracts = sortByDueAsc(docs.filter(isContractLike));
  const mitKündigungshinweis = contracts.filter(hasKündigungHint);

  return (
    <AppPageLayout
      title="Verträge & Laufzeiten"
      description="Auszug aus Dokumenten, die wie Verträge, Versicherungen oder Abos wirken – inkl. Hinweisen zu Kündigung oder Laufzeit im Text."
    >
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="underline-offset-2 hover:underline">
          ← Dashboard
        </Link>
      </p>

      <ViewSection title="Mögliche Kündigungs- oder Vertrags-Themen im Text">
        {mitKündigungshinweis.length === 0 ? (
          <ViewEmpty message="Keine Treffer mit passenden Stichworten." />
        ) : (
          mitKündigungshinweis.map((d) => (
            <ViewDocCard
              key={d.id}
              doc={d}
              extra={
                <p className="text-xs text-amber-800">
                  Hinweis: Text enthält Begriffe wie Kündigung, Frist oder Verlängerung – bitte
                  Original prüfen.
                </p>
              }
            />
          ))
        )}
      </ViewSection>

      <ViewSection title="Alle Vertrags-ähnlichen Dokumente">
        {contracts.length === 0 ? (
          <ViewEmpty message="Noch keine passenden Dokumente – nach Upload und Analyse erscheinen sie hier." />
        ) : (
          contracts.map((d) => <ViewDocCard key={d.id} doc={d} />)
        )}
      </ViewSection>
    </AppPageLayout>
  );
}
