/**
 * Scan-/Bild-PDFs: erste Seite als PNG rendern für Vision-LLM (Hybrid zu Text-Extraktion).
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import { createCanvas } from "@napi-rs/canvas";

import { ensurePdfjsEnvironmentForRendering } from "@/lib/documents/extract-content";

function pdfJsBundledAssetUrl(...segments: string[]): string {
  const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist", ...segments);
  return pathToFileURL(dir).href + "/";
}

const MAX_EDGE_PX = 2400;

/**
 * Rendert Seite 1 als PNG, Base64 ohne Präfix. Bei Fehler oder leerem PDF `null`.
 */
export async function renderPdfFirstPagePngBase64(buffer: Buffer): Promise<string | null> {
  try {
    await ensurePdfjsEnvironmentForRendering();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      disableRange: true,
      disableStream: true,
      standardFontDataUrl: pdfJsBundledAssetUrl("standard_fonts"),
      cMapUrl: pdfJsBundledAssetUrl("cmaps"),
      isEvalSupported: false,
      /** Node: weniger Standard-Font-Dateizugriffe aus dem Worker heraus. */
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    try {
      if (doc.numPages < 1) return null;
      const page = await doc.getPage(1);
      let scale = 2;
      const unit = page.getViewport({ scale: 1 });
      const maxDim = Math.max(unit.width, unit.height) * scale;
      if (maxDim > MAX_EDGE_PX) {
        scale *= MAX_EDGE_PX / maxDim;
      }
      const viewport = page.getViewport({ scale });
      const cw = Math.max(1, Math.floor(viewport.width));
      const ch = Math.max(1, Math.floor(viewport.height));
      const canvas = createCanvas(cw, ch);

      const renderTask = page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
        background: "rgb(255,255,255)",
      });
      await renderTask.promise;

      return canvas.toBuffer("image/png").toString("base64");
    } finally {
      await doc.destroy();
    }
  } catch {
    return null;
  }
}
