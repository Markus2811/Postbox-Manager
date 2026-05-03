"use client";

import { setDocumentWorkspaceBucket } from "@/app/dashboard/workspace-actions";
import type { DocumentWorkspaceBucket } from "@/lib/documents/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const mainBtnDefault =
  "inline-flex min-h-[2.25rem] items-center justify-center whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50";

const mainBtnToolbar =
  "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-lg border border-zinc-200/90 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50/80 disabled:opacity-50 sm:w-auto sm:min-w-[9rem]";

export function DashboardWorkspaceToggle({
  documentId,
  workspace,
  variant = "default",
}: {
  documentId: string;
  workspace: DocumentWorkspaceBucket;
  variant?: "default" | "toolbar";
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

  const mainBtnClass = variant === "toolbar" ? mainBtnToolbar : mainBtnDefault;
  const rootClass =
    variant === "toolbar"
      ? "flex w-full flex-col items-stretch gap-1 sm:w-auto"
      : "flex flex-col items-stretch gap-1 sm:items-end";

  return (
    <div className={rootClass}>
      {isDone ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void setInbox()}
          className={mainBtnClass}
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
            className={mainBtnClass}
          >
            Erledigen
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
