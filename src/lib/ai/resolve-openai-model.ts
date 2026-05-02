/**
 * Chat-Modell aus `OPENAI_MODEL` (Vercel / .env.local).
 * Korrigiert einen häufigen Tippfehler: `gpt-40-mini` → `gpt-4o-mini` (Ziffer 0 vs. Buchstabe o).
 */
export function resolveOpenAiChatModel(): string {
  const raw = process.env.OPENAI_MODEL?.trim();
  if (!raw) return "gpt-4o-mini";
  if (/^gpt-40-mini$/i.test(raw)) return "gpt-4o-mini";
  return raw;
}
