/**
 * Shared server-side logo binary validation (SEC-002).
 * Accepts only PNG / JPEG / WebP by magic bytes — never trusts MIME alone.
 */

export const MAX_LOGO_BINARY_BYTES = 2 * 1024 * 1024;

export const ALLOWED_LOGO_RASTER_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedLogoRasterContentType =
  (typeof ALLOWED_LOGO_RASTER_CONTENT_TYPES)[number];

export type LogoRasterExtension = "png" | "jpg" | "webp";

export type LogoBinaryValidationErrorCode =
  | "empty_file"
  | "unsupported_type"
  | "file_too_large";

export type ValidateLogoBinaryResult =
  | {
      ok: true;
      contentType: AllowedLogoRasterContentType;
      extension: LogoRasterExtension;
    }
  | {
      ok: false;
      code: LogoBinaryValidationErrorCode;
      message: string;
    };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SOI = [0xff, 0xd8, 0xff] as const;
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38] as const; // GIF8
const ICO_SIGNATURE = [0x00, 0x00, 0x01, 0x00] as const;

function startsWithBytes(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (bytes.byteLength < signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  // RIFF....WEBP
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

/**
 * True when leading bytes look like SVG / HTML / XML markup (after BOM + whitespace).
 */
export function looksLikeRejectedMarkup(bytes: Uint8Array): boolean {
  let offset = 0;
  if (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    offset = 3;
  }

  while (offset < bytes.byteLength) {
    const b = bytes[offset];
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) {
      offset += 1;
      continue;
    }
    break;
  }

  const slice = bytes.subarray(offset, Math.min(offset + 256, bytes.byteLength));
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(slice)
    .toLowerCase();

  return (
    head.startsWith("<?xml") ||
    head.startsWith("<svg") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<xml")
  );
}

export type DetectedLogoRasterFormat = {
  contentType: AllowedLogoRasterContentType;
  extension: LogoRasterExtension;
};

/**
 * Detect PNG / JPEG / WebP from magic bytes. Returns null for everything else
 * (including SVG, GIF, ICO, HTML/XML, unknown).
 */
export function detectLogoRasterFormat(
  bytes: Uint8Array,
): DetectedLogoRasterFormat | null {
  if (startsWithBytes(bytes, PNG_SIGNATURE)) {
    return { contentType: "image/png", extension: "png" };
  }
  if (startsWithBytes(bytes, JPEG_SOI)) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (isWebp(bytes)) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export function logoBinaryValidationErrorMessage(
  code: LogoBinaryValidationErrorCode,
): string {
  switch (code) {
    case "empty_file":
      return "Logo file is empty.";
    case "unsupported_type":
      return "Please upload a PNG, JPG, or WebP image.";
    case "file_too_large":
      return "Logo must be 2 MB or smaller.";
    default:
      return "Invalid logo file.";
  }
}

/**
 * Validate logo bytes for public Storage writes.
 * MIME / declared content-type is ignored — only size + magic bytes decide.
 */
export function validateLogoBinary(bytes: Uint8Array): ValidateLogoBinaryResult {
  if (bytes.byteLength === 0) {
    return {
      ok: false,
      code: "empty_file",
      message: logoBinaryValidationErrorMessage("empty_file"),
    };
  }

  if (bytes.byteLength > MAX_LOGO_BINARY_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: logoBinaryValidationErrorMessage("file_too_large"),
    };
  }

  if (
    startsWithBytes(bytes, GIF_SIGNATURE) ||
    startsWithBytes(bytes, ICO_SIGNATURE) ||
    looksLikeRejectedMarkup(bytes)
  ) {
    return {
      ok: false,
      code: "unsupported_type",
      message: logoBinaryValidationErrorMessage("unsupported_type"),
    };
  }

  const detected = detectLogoRasterFormat(bytes);
  if (!detected) {
    return {
      ok: false,
      code: "unsupported_type",
      message: logoBinaryValidationErrorMessage("unsupported_type"),
    };
  }

  return {
    ok: true,
    contentType: detected.contentType,
    extension: detected.extension,
  };
}

/** Soft remote Content-Type prefilter (not a security control). */
export function isAllowedLogoRasterContentType(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "image/jpg") return true;
  return (ALLOWED_LOGO_RASTER_CONTENT_TYPES as readonly string[]).includes(base);
}
