export function DashboardInsights({
  inboxCount,
  doneCount,
  totalDocuments,
}: {
  inboxCount: number;
  doneCount: number;
  totalDocuments: number;
}) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/80">
      <p className="text-sm text-zinc-700">
        <span className="font-semibold text-zinc-900">{inboxCount}</span> offen ·{" "}
        <span className="font-semibold text-zinc-900">{doneCount}</span> erledigt ·{" "}
        <span className="text-zinc-500">{totalDocuments} gesamt</span>
      </p>
    </div>
  );
}
