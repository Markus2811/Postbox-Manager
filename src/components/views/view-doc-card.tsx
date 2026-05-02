import { formatCurrency, formatDate } from "@/lib/documents/format";
import type { DocumentWithMetadata } from "@/lib/documents/types";
import Link from "next/link";
import type { ReactNode } from "react";

export function ViewDocCard({
  doc,
  extra,
}: {
  doc: DocumentWithMetadata;
  extra?: ReactNode;
}) {
  const m = doc.document_metadata;
  return (
    <Link
      href={`/documents/${doc.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">
            {doc.display_name ?? doc.original_filename}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {m?.sender ?? "—"} · {m?.document_type ?? "—"} · {doc.category ?? "—"}
          </p>
          {m?.summary ? (
            <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{m.summary}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right text-xs text-zinc-500 sm:ml-4">
          <div>Frist: {formatDate(m?.due_date ?? null)}</div>
          <div>Betrag: {formatCurrency(m?.amount ?? null, m?.currency ?? null)}</div>
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            {doc.workspace_bucket === "done" ? (
              <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900">
                Erledigt
              </span>
            ) : null}
            {doc.user_edited_at ? (
              <span className="inline-block rounded bg-sky-100 px-1.5 py-0.5 text-sky-900">
                Bearbeitet
              </span>
            ) : null}
            {m?.action_required ? (
              <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                Handlung
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {extra ? <div className="mt-2 border-t border-zinc-100 pt-2">{extra}</div> : null}
    </Link>
  );
}

export function ViewEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

export function ViewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
