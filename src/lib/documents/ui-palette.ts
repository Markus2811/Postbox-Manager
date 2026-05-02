/** Tailwind-Klassen für Kategorie- und Typ-Charts (konsistent mit Analytics/Fristen). */

export type PaletteSwatch = {
  bar: string;
  soft: string;
  text: string;
  border: string;
};

const CATEGORY_PALETTE: Record<string, PaletteSwatch> = {
  Rechnungen: {
    bar: "bg-amber-500",
    soft: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-200",
  },
  Verträge: {
    bar: "bg-violet-500",
    soft: "bg-violet-100",
    text: "text-violet-900",
    border: "border-violet-200",
  },
  Versicherungen: {
    bar: "bg-sky-500",
    soft: "bg-sky-100",
    text: "text-sky-900",
    border: "border-sky-200",
  },
  "Bank & Finanzen": {
    bar: "bg-emerald-500",
    soft: "bg-emerald-100",
    text: "text-emerald-900",
    border: "border-emerald-200",
  },
  Steuern: {
    bar: "bg-orange-500",
    soft: "bg-orange-100",
    text: "text-orange-900",
    border: "border-orange-200",
  },
  Gesundheit: {
    bar: "bg-rose-500",
    soft: "bg-rose-100",
    text: "text-rose-900",
    border: "border-rose-200",
  },
  Behörden: {
    bar: "bg-slate-500",
    soft: "bg-slate-100",
    text: "text-slate-900",
    border: "border-slate-200",
  },
  Sonstiges: {
    bar: "bg-zinc-400",
    soft: "bg-zinc-100",
    text: "text-zinc-800",
    border: "border-zinc-200",
  },
  "Ohne Kategorie": {
    bar: "bg-gray-400",
    soft: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-200",
  },
};

const TYPE_FALLBACK: PaletteSwatch[] = [
  { bar: "bg-indigo-500", soft: "bg-indigo-100", text: "text-indigo-900", border: "border-indigo-200" },
  { bar: "bg-teal-500", soft: "bg-teal-100", text: "text-teal-900", border: "border-teal-200" },
  { bar: "bg-fuchsia-500", soft: "bg-fuchsia-100", text: "text-fuchsia-900", border: "border-fuchsia-200" },
  { bar: "bg-lime-500", soft: "bg-lime-100", text: "text-lime-900", border: "border-lime-200" },
  { bar: "bg-cyan-500", soft: "bg-cyan-100", text: "text-cyan-900", border: "border-cyan-200" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function paletteForCategory(category: string | null | undefined): PaletteSwatch {
  const key = category?.trim() || "Ohne Kategorie";
  return CATEGORY_PALETTE[key] ?? TYPE_FALLBACK[hashString(key) % TYPE_FALLBACK.length];
}

export function paletteForDocumentTypeKey(typeKey: string): PaletteSwatch {
  return TYPE_FALLBACK[hashString(typeKey) % TYPE_FALLBACK.length];
}
