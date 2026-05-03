import { redirect } from "next/navigation";

/** Alte URLs leiten ins Dashboard mit geöffneter Detailansicht weiter. */
export default async function DocumentDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trimmed = id?.trim();
  if (!trimmed) {
    redirect("/dashboard");
  }
  redirect(`/dashboard?focus=${encodeURIComponent(trimmed)}`);
}
