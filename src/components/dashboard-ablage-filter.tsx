import Link from "next/link";

export function DashboardAblageFilter({
  activeAblage,
}: {
  activeAblage: "alle" | "inbox" | "done";
}) {
  const linkClass = (key: typeof activeAblage) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition ${
      activeAblage === key
        ? "bg-zinc-900 text-white shadow-sm"
        : "bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200/80 hover:bg-zinc-50"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-zinc-500">Ansicht</span>
      <Link href="/dashboard" className={linkClass("alle")}>
        Übersicht
      </Link>
      <Link href="/dashboard?ablage=inbox" className={linkClass("inbox")}>
        Posteingang
      </Link>
      <Link href="/dashboard?ablage=done" className={linkClass("done")}>
        Erledigt
      </Link>
    </div>
  );
}
