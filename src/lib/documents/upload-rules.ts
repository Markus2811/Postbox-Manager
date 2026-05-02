export const UPLOAD_ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const UPLOAD_MAX_BYTES = 45 * 1024 * 1024;

export type UploadExtension = "pdf" | "jpg" | "png";

export type UploadInitPayload = {
  contentHash: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  extension: UploadExtension;
};

function isSha256Hex(s: string): boolean {
  return /^[a-f0-9]{64}$/.test(s);
}

export function safeOriginalFilename(name: string): string {
  const t = name.trim().replace(/[/\\]/g, "_").slice(0, 255);
  return t.length > 0 ? t : "upload.bin";
}

export function mimeForExtension(ext: UploadExtension): string {
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

/**
 * Serverseitige Validierung für `/api/documents/upload-init`.
 * Gibt normalisierte Felder oder eine deutsche Fehlermeldung zurück.
 */
export function parseUploadInitPayload(
  raw: unknown
): { ok: true; value: UploadInitPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Ungültiger JSON-Body." };
  }
  const o = raw as Record<string, unknown>;
  const contentHash =
    typeof o.contentHash === "string" ? o.contentHash.trim().toLowerCase() : "";
  const originalFilename =
    typeof o.originalFilename === "string" ? o.originalFilename : "";
  const mimeType = typeof o.mimeType === "string" ? o.mimeType.trim().toLowerCase() : "";
  const fileSize = typeof o.fileSize === "number" ? o.fileSize : NaN;
  const ext = o.extension;

  if (!isSha256Hex(contentHash)) {
    return { ok: false, error: "contentHash muss SHA-256 (64 Hex-Zeichen) sein." };
  }
  if (!originalFilename.trim()) {
    return { ok: false, error: "originalFilename fehlt." };
  }
  if (!UPLOAD_ALLOWED_MIMES.has(mimeType)) {
    return { ok: false, error: "Dateityp nicht erlaubt." };
  }
  if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > UPLOAD_MAX_BYTES) {
    return { ok: false, error: `Dateigröße ungültig (max. ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB).` };
  }
  if (ext !== "pdf" && ext !== "jpg" && ext !== "png") {
    return { ok: false, error: "extension muss pdf, jpg oder png sein." };
  }
  if (mimeForExtension(ext) !== mimeType) {
    return { ok: false, error: "mimeType passt nicht zur extension." };
  }

  return {
    ok: true,
    value: {
      contentHash,
      originalFilename: safeOriginalFilename(originalFilename),
      mimeType,
      fileSize,
      extension: ext,
    },
  };
}
