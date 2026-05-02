"use client";

import { updateDocumentMetadataGrid } from "@/app/dokumentenliste/grid-actions";
import { DOCUMENT_TYPES } from "@/lib/documents/categories";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type EditableGridRow = {
  id: string;
  original_filename: string;
  display_title: string;
  category: string | null;
  /** Erledigt-Notiz (nur Anzeige). */
  completion_note: string;
  workspace_label: string;
  status_label: string;
  created_at: string;
  recipient: string;
  payer: string;
  meta: {
    document_type: string;
    document_date: string;
    due_date: string;
    sender: string;
    amount: string;
    currency: string;
    action_required: boolean;
    action_description: string;
    summary: string;
  };
};

function formatDateDe(iso: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "—";
  return `${day}.${m}.${y}`;
}

function parseAmount(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function RowEditor({ row }: { row: EditableGridRow }) {
  const router = useRouter();
  const [meta, setMeta] = useState(row.meta);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMeta(row.meta);
  }, [row.id, JSON.stringify(row.meta), row.completion_note]);

  async function save() {
    setMsg(null);
    setBusy(true);
    const res = await updateDocumentMetadataGrid(row.id, {
      document_type: meta.document_type.trim() || null,
      document_date: meta.document_date.trim() || null,
      due_date: meta.due_date.trim() || null,
      sender: meta.sender.trim() || null,
      amount: parseAmount(meta.amount),
      currency: meta.currency.trim() || null,
      summary: meta.summary.trim() || null,
      action_required: meta.action_required,
      action_description: meta.action_description.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg("Gespeichert.");
    router.refresh();
  }

  const inputCls =
    "w-full min-w-[5rem] max-w-[10rem] rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-400";

  return (
    <tr className="border-b border-zinc-100 align-top hover:bg-zinc-50/80">
      <td className="whitespace-nowrap px-2 py-2">
        <Link href={`/documents/${row.id}`} className="text-xs font-semibold text-sky-700 underline-offset-2 hover:underline">
          Öffnen
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="mt-1 block w-full rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "…" : "Speichern"}
        </button>
        {msg ? <span className="mt-1 block text-[10px] text-zinc-600">{msg}</span> : null}
      </td>
      <td className="max-w-[9rem] px-2 py-2 text-xs text-zinc-700" title={row.original_filename}>
        <span className="line-clamp-2">{row.original_filename}</span>
      </td>
      <td className="max-w-[9rem] px-2 py-2 text-xs text-zinc-800">{row.display_title}</td>
      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">{row.category ?? "—"}</td>
      <td className="max-w-[10rem] px-2 py-2 text-xs text-zinc-600" title={row.completion_note || undefined}>
        {row.completion_note?.trim() ? <span className="line-clamp-3">{row.completion_note}</span> : "—"}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-zinc-800">{row.workspace_label}</td>
      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">{row.status_label}</td>
      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600">{formatDateDe(row.created_at)}</td>
      <td className="px-2 py-2">
        <select
          value={meta.document_type || ""}
          onChange={(e) => setMeta((m) => ({ ...m, document_type: e.target.value }))}
          className={inputCls}
        >
          <option value="">—</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={meta.document_date}
          onChange={(e) => setMeta((m) => ({ ...m, document_date: e.target.value }))}
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={meta.due_date}
          onChange={(e) => setMeta((m) => ({ ...m, due_date: e.target.value }))}
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={meta.sender}
          onChange={(e) => setMeta((m) => ({ ...m, sender: e.target.value }))}
          className={`${inputCls} max-w-[9rem]`}
        />
      </td>
      <td className="max-w-[7rem] px-2 py-2 text-xs text-zinc-500" title={row.recipient}>
        {row.recipient || "—"}
      </td>
      <td className="max-w-[7rem] px-2 py-2 text-xs text-zinc-500" title={row.payer}>
        {row.payer || "—"}
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <input
            value={meta.amount}
            onChange={(e) => setMeta((m) => ({ ...m, amount: e.target.value }))}
            className={`${inputCls} max-w-[6rem]`}
            inputMode="decimal"
          />
          <input
            value={meta.currency}
            onChange={(e) => setMeta((m) => ({ ...m, currency: e.target.value }))}
            className={`${inputCls} max-w-[3.5rem]`}
            maxLength={3}
          />
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={meta.action_required}
          onChange={(e) => setMeta((m) => ({ ...m, action_required: e.target.checked }))}
          className="h-4 w-4 rounded border-zinc-300"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={meta.action_description}
          onChange={(e) => setMeta((m) => ({ ...m, action_description: e.target.value }))}
          className={`${inputCls} max-w-[10rem]`}
        />
      </td>
      <td className="px-2 py-2">
        <textarea
          value={meta.summary}
          onChange={(e) => setMeta((m) => ({ ...m, summary: e.target.value }))}
          rows={2}
          className={`${inputCls} max-w-[12rem] resize-y`}
        />
      </td>
    </tr>
  );
}

export function EditableDocumentsTable({ rows }: { rows: EditableGridRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-[88rem] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <th className="px-2 py-2">Link / Speichern</th>
            <th className="px-2 py-2">Datei</th>
            <th className="px-2 py-2">Titel</th>
            <th className="px-2 py-2">Kategorie</th>
            <th className="px-2 py-2">Notizen</th>
            <th className="px-2 py-2">Ablage</th>
            <th className="px-2 py-2">Auswertung</th>
            <th className="px-2 py-2">Hochgeladen</th>
            <th className="px-2 py-2">Typ (edit.)</th>
            <th className="px-2 py-2">Belegdatum</th>
            <th className="px-2 py-2">Frist</th>
            <th className="px-2 py-2">Absender</th>
            <th className="px-2 py-2">Zahlungsempf.</th>
            <th className="px-2 py-2">Zahler</th>
            <th className="px-2 py-2">Betrag</th>
            <th className="px-2 py-2">Aktion</th>
            <th className="px-2 py-2">Aktionshinweis</th>
            <th className="px-2 py-2">Kurztext</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <RowEditor key={r.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
