import { DOCUMENT_TYPES } from "@/lib/documents/categories";
import { z } from "zod";

const isoDateOrNull = z.union([
  z.null(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein"),
]);

export const documentAnalysisSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  sender: z.string().nullable(),
  document_date: isoDateOrNull,
  due_date: isoDateOrNull,
  amount: z.number().finite().nullable(),
  currency: z.enum(["EUR", "USD", "CHF"]).nullable(),
  category: z.string().nullable().optional(),
  summary: z.string(),
  action_required: z.boolean(),
  action_description: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  /** Bei Fotos: alles Lesbare (Tabellen, handschriftliche Zahlen) für Fragen & Volltext. */
  image_transcript: z.string().max(120_000).nullish(),
});

export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;
