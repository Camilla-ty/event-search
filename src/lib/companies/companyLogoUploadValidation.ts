import { companyLogoObjectPath } from "@/src/features/companies/server/companyLogoStorage";
import {
  MAX_LOGO_BINARY_BYTES,
  validateLogoBinary,
  type AllowedLogoRasterContentType,
  type LogoBinaryValidationErrorCode,
  type LogoRasterExtension,
} from "@/src/lib/companies/logoBinaryValidation";

export {
  isAllowedLogoRasterContentType,
  validateLogoBinary,
} from "@/src/lib/companies/logoBinaryValidation";

/** @deprecated Prefer MAX_LOGO_BINARY_BYTES — kept for existing imports. */
export const MAX_COMPANY_LOGO_SIZE_BYTES = MAX_LOGO_BINARY_BYTES;

export const ALLOWED_MANUAL_LOGO_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export type AllowedManualLogoUploadMimeType =
  | AllowedLogoRasterContentType
  | "image/jpg";

export type CompanyLogoUploadValidationErrorCode =
  | "missing_file"
  | LogoBinaryValidationErrorCode;

export type ValidateCompanyLogoUploadInput = {
  bytes: Uint8Array;
  /** Declared MIME is ignored for accept/reject; retained for call-site compat. */
  mimeType?: string;
};

export type ValidateCompanyLogoUploadResult =
  | {
      ok: true;
      contentType: AllowedLogoRasterContentType;
      extension: LogoRasterExtension;
    }
  | { ok: false; code: CompanyLogoUploadValidationErrorCode; message: string };

export function normalizeManualLogoUploadMimeType(
  mimeType: string,
): AllowedManualLogoUploadMimeType | null {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    ALLOWED_MANUAL_LOGO_UPLOAD_MIME_TYPES.includes(
      normalized as (typeof ALLOWED_MANUAL_LOGO_UPLOAD_MIME_TYPES)[number],
    )
  ) {
    return normalized as AllowedManualLogoUploadMimeType;
  }
  return null;
}

export function extensionForManualLogoUploadMimeType(
  contentType: AllowedManualLogoUploadMimeType,
): LogoRasterExtension {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function companyLogoUploadStoragePath(
  companyId: string,
  extension: LogoRasterExtension,
): string {
  return companyLogoObjectPath(companyId, extension);
}

/**
 * Validate a manual logo upload. Acceptance is driven by magic bytes only.
 */
export function validateCompanyLogoUpload(
  input: ValidateCompanyLogoUploadInput,
): ValidateCompanyLogoUploadResult {
  return validateLogoBinary(input.bytes);
}

export function companyLogoUploadValidationErrorMessage(
  code: CompanyLogoUploadValidationErrorCode,
): string {
  switch (code) {
    case "missing_file":
      return "Logo file is required.";
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
