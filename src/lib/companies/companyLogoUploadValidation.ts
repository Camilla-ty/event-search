import {
  companyLogoObjectPath,
  MAX_COMPANY_LOGO_SIZE_BYTES,
} from "@/src/features/companies/server/companyLogoStorage";

export { MAX_COMPANY_LOGO_SIZE_BYTES };

export const ALLOWED_MANUAL_LOGO_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export type AllowedManualLogoUploadMimeType =
  (typeof ALLOWED_MANUAL_LOGO_UPLOAD_MIME_TYPES)[number];

export type CompanyLogoUploadValidationErrorCode =
  | "missing_file"
  | "empty_file"
  | "unsupported_type"
  | "file_too_large";

export type ValidateCompanyLogoUploadInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export type ValidateCompanyLogoUploadResult =
  | { ok: true; contentType: AllowedManualLogoUploadMimeType; extension: "png" | "jpg" | "webp" }
  | { ok: false; code: CompanyLogoUploadValidationErrorCode; message: string };

const MIME_TO_EXTENSION: Record<AllowedManualLogoUploadMimeType, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export function normalizeManualLogoUploadMimeType(
  mimeType: string,
): AllowedManualLogoUploadMimeType | null {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    ALLOWED_MANUAL_LOGO_UPLOAD_MIME_TYPES.includes(
      normalized as AllowedManualLogoUploadMimeType,
    )
  ) {
    return normalized as AllowedManualLogoUploadMimeType;
  }
  return null;
}

export function extensionForManualLogoUploadMimeType(
  contentType: AllowedManualLogoUploadMimeType,
): "png" | "jpg" | "webp" {
  return MIME_TO_EXTENSION[contentType];
}

export function companyLogoUploadStoragePath(
  companyId: string,
  extension: "png" | "jpg" | "webp",
): string {
  return companyLogoObjectPath(companyId, extension);
}

export function validateCompanyLogoUpload(
  input: ValidateCompanyLogoUploadInput,
): ValidateCompanyLogoUploadResult {
  if (input.bytes.byteLength === 0) {
    return {
      ok: false,
      code: "empty_file",
      message: "Logo file is empty.",
    };
  }

  if (input.bytes.byteLength > MAX_COMPANY_LOGO_SIZE_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: "Logo must be 2 MB or smaller.",
    };
  }

  const contentType = normalizeManualLogoUploadMimeType(input.mimeType);
  if (!contentType) {
    return {
      ok: false,
      code: "unsupported_type",
      message: "Please upload a PNG, JPG, or WebP image.",
    };
  }

  return {
    ok: true,
    contentType,
    extension: extensionForManualLogoUploadMimeType(contentType),
  };
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
