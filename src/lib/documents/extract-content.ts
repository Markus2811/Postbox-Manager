/**
 * Text aus PDF (pdf-parse v2). Bilder: leerer Text → Aufrufer kann Vision nutzen.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

export type ExtractResult = {
  text: string;
  needsVision: boolean;
};

/**
 * pdfjs (in pdf-parse v2) erwartet Browser-Globals wie `DOMMatrix`.
 * Unter Node (u. a. Vercel Serverless) fehlen die — @napi-rs/canvas stellt sie bereit
 * (gleiches Muster wie `pdf-parse/worker`).
 */
/** Gleiche pdfjs-Umgebung wie für Text-Extraktion (z. B. erste Seite als PNG). */
export async function ensurePdfjsEnvironmentForRendering(): Promise<void> {
  await ensurePdfjsCanvasGlobals();
  await ensurePdfjsWorkerSrc();
}

async function ensurePdfjsCanvasGlobals(): Promise<void> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g.DOMMatrix) return;

  const { DOMMatrix, Path2D, ImageData } = await import("@napi-rs/canvas");
  g.DOMMatrix = DOMMatrix;
  if (!g.Path2D) g.Path2D = Path2D;
  if (!g.ImageData) g.ImageData = ImageData;
}

/**
 * Fake-Worker in Node importiert `GlobalWorkerOptions.workerSrc` dynamisch.
 * Relativer Default `./pdf.worker.mjs` scheitert nach Next-Bundling / auf Vercel
 * (`Cannot find module .../pdf.worker.mjs`). Absolute file-URL + Tracing-Fix.
 */
async function ensurePdfjsWorkerSrc(): Promise<void> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
}

export async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractResult> {
  const mt = mimeType.toLowerCase();

  if (mt === "application/pdf") {
    await ensurePdfjsCanvasGlobals();
    await ensurePdfjsWorkerSrc();
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
