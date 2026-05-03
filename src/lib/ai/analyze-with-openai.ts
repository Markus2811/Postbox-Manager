import {
  documentAnalysisSchema,
  type DocumentAnalysis,
} from "@/lib/ai/document-analysis-schema";
import { resolveOpenAiChatModel } from "@/lib/ai/resolve-openai-model";
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
  "confidence": number,
  "image_transcript": string | null
}

Regeln:
- Setze Felder auf null, wenn der Wert nicht eindeutig im Dokument steht. Erfinde keine Absender, Beträge oder Daten.
- document_type nur setzen, wenn es passt; sonst "other".
- Datumsfelder nur mit YYYY-MM-DD oder null.
- amount nur wenn ein klarer Geldbetrag erkennbar ist.
- confidence: 0–1, niedrig wenn unsicher oder wenig Text.
- summary: max. 3 Sätze, sachlich, Deutsch.
- image_transcript: Wenn KEIN Bild in der Nachricht ist (nur extrahierter Text), setze null oder "".
  Wenn ein Bild mitgeschickt ist: Pflicht eine möglichst vollständige Abschrift für Nachfragen (Punkte, Tabellen, Formulare):
  gedruckter Text, Tabellen ZEILE FÜR ZEILE (z. B. Bahn/Löcher mit Zahlen pro Spalte), handschriftliche Ziffern und Kürzel so genau wie lesbar.
  Struktur frei (Stichpunkte oder Zeilen ok). Unleserliches mit [unklar] markieren. Nichts erfinden.`;

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

  const model = resolveOpenAiChatModel();
  const openai = new OpenAI({ apiKey });

  const hasImage = Boolean(input.imageBase64 && input.mimeType.startsWith("image/"));

  let userText = `Dateiname: ${input.originalFilename}\nMIME: ${input.mimeType}\n\n${
    input.text.length > 0
      ? `Extrahierter Text:\n${input.text}`
      : "Kein maschinenlesbarer Text vorhanden."
  }`;

  if (hasImage) {
    userText +=
      "\n\nEs ist ein Bild angehängt: image_transcript muss alle erkennbaren Zahlen und Tabellenzeilen enthalten (z. B. Minigolf-Scorekarte: pro Bahn die Punkte je Spieler, Initialen, Summen falls sichtbar).";
  }

  const userParts: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: userText }];

  if (hasImage && input.imageBase64) {
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
    max_completion_tokens: 8192,
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
