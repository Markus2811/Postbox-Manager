"use client";

import { setDocumentWorkspaceBucket } from "@/app/dashboard/workspace-actions";
import type { DocumentWorkspaceBucket } from "@/lib/documents/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardWorkspaceToggle({
  documentId,
  workspace,
}: {
  documentId: string;
  workspace: DocumentWorkspaceBucket;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState("");

  const isDone = workspace === "done";

  async function setInbox() {
    setLocalError(null);
    setBusy(true);
    const res = await setDocumentWorkspaceBucket(documentId, "inbox");
    setBusy(false);
    if (!res.ok) {
      setLocalError(res.error);
      return;
    }
    router.refresh();
  }

  async function setDoneWithNote() {
    setLocalError(null);
    setBusy(true);
    const res = await setDocumentWorkspaceBucket(documentId, "done", {
      completionNote: note,
    });
    setBusy(false);
    if (!res.ok) {
      setLocalError(res.error);
      return;
    }
    setDialogOpen(false);
    setNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      {isDone ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void setInbox()}
          className="whitespace-nowrap rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {busy ? "…" : "Wieder öffnen"}
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLocalError(null);
              setNote("");
              setDialogOpen(true);
            }}
            className="whitespace-nowrap rounded-full border border-emerald-300/90 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100/90 disabled:opacity-50"
          >
            Erledigt
          </button>
          {dialogOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setDialogOpen(false);
              }}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="done-dialog-title"
              >
                <h2 id="done-dialog-title" className="text-lg font-semibold text-zinc-900">
                  Als erledigt speichern
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  Optional eine Notiz für dein Protokoll (z. B. bezahlt, widersprochen, abgelegt).
                </p>
                <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor={`note-${documentId}`}>
                  Notiz
                </label>
                <textarea
                  id={`note-${documentId}`}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
                  placeholder="Optional …"
                />
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                    disabled={busy}
                    onClick={() => setDialogOpen(false)}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setDoneWithNote()}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "Speichern …" : "Erledigt speichern"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
      {localError ? (
        <p className="max-w-[14rem] text-[11px] font-medium leading-snug text-red-600" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
