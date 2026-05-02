/**
 * Text aus PDF (pdf-parse v2). Bilder: leerer Text → Aufrufer kann Vision nutzen.
 */

export type ExtractResult = {
  text: string;
  needsVision: boolean;
};

export async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractResult> {
  const mt = mimeType.toLowerCase();

  if (mt === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text ?? "").replace(/\s+/g, " ").trim();
      return { text: text.slice(0, 48_000), needsVision: text.length < 40 };
    } finally {
      await parser.destroy();
    }
  }

  if (mt === "image/jpeg" || mt === "image/png" || mt === "image/webp") {
    return { text: "", needsVision: true };
  }

  return { text: "", needsVision: false };
}
