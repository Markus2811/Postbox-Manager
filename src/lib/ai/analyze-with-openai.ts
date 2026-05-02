import {
  documentAnalysisSchema,
  type DocumentAnalysis,
} from "@/lib/ai/document-analysis-schema";
import OpenAI from "openai";
import { z } from "zod";

const SYSTEM = `Du bist ein Assistent für deutsche Privatpost und Dokumente.
Analysiere den Inhalt und antworte NUR mit einem JSON-Objekt (kein Markdown), das exakt diesem Schema entspricht:
{
  "document_type": "invoice" | "contract" | "insurance" | "bank" | "tax" | "medical" | "government" | "other",
  "sender": string | null,
  "document_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "amount": number | null,
  "currency": "EUR" | "USD" | "CHF" | null,
  "category": string | null,
  "summary": string,
  "action_required": boolean,
  "action_description": string | null,
  "confidence": number
}

Regeln:
- Setze Felder auf null, wenn der Wert nicht eindeutig im Dokument steht. Erfinde keine Absender, Beträge oder Daten.
- document_type nur setzen, wenn es passt; sonst "other".
- Datumsfelder nur mit YYYY-MM-DD oder null.
- amount nur wenn ein klarer Geldbetrag erkennbar ist.
- confidence: 0–1, niedrig wenn unsicher oder wenig Text.
- summary: max. 3 Sätze, sachlich, Deutsch.`;

export async function analyzeWithOpenAI(input: {
  text: string;
  originalFilename: string;
  mimeType: string;
  imageBase64?: string;
}): Promise<DocumentAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY fehlt");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  const userParts: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `Dateiname: ${input.originalFilename}\nMIME: ${input.mimeType}\n\n${
        input.text.length > 0
          ? `Extrahierter Text:\n${input.text}`
          : "Kein maschinenlesbarer Text vorhanden."
      }`,
    },
  ];

  if (input.imageBase64 && input.mimeType.startsWith("image/")) {
    userParts.push({
      type: "image_url",
      image_url: {
        url: `data:${input.mimeType};base64,${input.imageBase64}`,
        detail: "high",
      },
    });
  }

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userParts },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Leere OpenAI-Antwort");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI lieferte kein gültiges JSON");
  }

  try {
    return documentAnalysisSchema.parse(parsed);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`JSON-Validierung fehlgeschlagen: ${e.message}`);
    }
    throw e;
  }
}
