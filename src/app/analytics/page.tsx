import { AnalyticsDashboard } from "@/app/analytics/analytics-dashboard";
import { AppPageLayout } from "@/components/app-page-layout";
import { computeDocumentAnalytics } from "@/lib/documents/analytics";
import { getDocumentsWithMetadata } from "@/lib/documents/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const docs = await getDocumentsWithMetadata(supabase, user.id);
  const a = computeDocumentAnalytics(docs);

  return (
    <AppPageLayout
      wide
      title="Überblick"
      description="Auf einen Blick: Fristen, Handlungen und Schwerpunkte — ohne Tabellenbericht."
    >
      <AnalyticsDashboard data={a} />
    </AppPageLayout>
  );
}
