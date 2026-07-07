import { createAdminClient } from "@/src/lib/supabase/admin";
import { bucketRelativePathFromLogoReference } from "@/src/lib/storage/bucketRelativeLogoPath";

export const COMPANY_LOGO_BUCKET = process.env.BACKFILL_LOGO_BUCKET ?? "company-logos";
export const COMPANY_LOGO_STORAGE_NAMESPACE = "companies";
export const MAX_COMPANY_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/** Known logo file extensions that may exist under a company folder. */
export const COMPANY_LOGO_STALE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
  "gif",
  "ico",
  "bin",
] as const;

const COMPANY_ID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COMPANY_LOGO_OBJECT_PATTERN =
  /^companies\/([^/]+)\/logo\.([a-z0-9]+)$/i;

export type ParsedCompanyLogoStoragePath = {
  bucketRelativePath: string;
  companyId: string | null;
  extension: string;
  isLegacyPath: boolean;
  legacyIdentityKey: string | null;
};

export function extensionForContentType(contentType: string): string {
  const value = contentType.toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("webp")) return "webp";
  if (value.includes("svg")) return "svg";
  if (value.includes("gif")) return "gif";
  if (value.includes("icon")) return "ico";
  return "bin";
}

export function companyLogoObjectPath(companyId: string, extension: string): string {
  const id = companyId.trim();
  const ext = extension.trim().toLowerCase();
  return `${COMPANY_LOGO_STORAGE_NAMESPACE}/${id}/logo.${ext}`;
}

export function isCompanyIdLogoStorageSegment(segment: string): boolean {
  return COMPANY_ID_SEGMENT_PATTERN.test(segment.trim());
}

export function parseCompanyLogoStoragePathFromUrl(
  url: string | null | undefined,
): ParsedCompanyLogoStoragePath | null {
  const bucketRelativePath = bucketRelativePathFromLogoReference(url);
  if (!bucketRelativePath) return null;

  const match = COMPANY_LOGO_OBJECT_PATTERN.exec(bucketRelativePath);
  if (!match) return null;

  const identitySegment = match[1] ?? "";
  const extension = (match[2] ?? "").toLowerCase();
  if (!identitySegment || !extension) return null;

  const isLegacyPath = !isCompanyIdLogoStorageSegment(identitySegment);

  return {
    bucketRelativePath,
    companyId: isLegacyPath ? null : identitySegment,
    extension,
    isLegacyPath,
    legacyIdentityKey: isLegacyPath ? identitySegment : null,
  };
}

export function selectStaleCompanyLogoCleanupPaths(params: {
  companyId: string;
  activeStoragePath: string;
}): string[] {
  const companyId = params.companyId.trim();
  const activePath = params.activeStoragePath.trim();
  if (!companyId || !activePath) return [];

  const activePrefix = `${COMPANY_LOGO_STORAGE_NAMESPACE}/${companyId}/`;
  if (!activePath.startsWith(activePrefix)) return [];

  const stalePaths: string[] = [];
  for (const extension of COMPANY_LOGO_STALE_EXTENSIONS) {
    const candidate = companyLogoObjectPath(companyId, extension);
    if (candidate !== activePath) {
      stalePaths.push(candidate);
    }
  }

  return stalePaths;
}

export type UploadCompanyLogoBytesResult =
  | { ok: true; publicUrl: string; storagePath: string }
  | { ok: false; error: string };

export async function uploadCompanyLogoBytes(params: {
  companyId: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<UploadCompanyLogoBytesResult> {
  const companyId = params.companyId.trim();
  if (!companyId) {
    return { ok: false, error: "missing_company_id" };
  }

  if (params.bytes.byteLength === 0) {
    return { ok: false, error: "empty_file" };
  }

  if (params.bytes.byteLength > MAX_COMPANY_LOGO_SIZE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  const extension = extensionForContentType(params.contentType);
  const storagePath = companyLogoObjectPath(companyId, extension);
  const normalizedContentType =
    params.contentType.split(";")[0]?.trim() || params.contentType;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(storagePath, params.bytes, {
      upsert: true,
      contentType: normalizedContentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { ok: false, error: "upload_failed" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(storagePath);

  if (!publicUrl) {
    return { ok: false, error: "public_url_failed" };
  }

  return { ok: true, publicUrl, storagePath };
}

export type VerifyCompanyLogoStorageObjectResult =
  | { ok: true; byteLength: number }
  | { ok: false; error: string };

export async function verifyCompanyLogoStorageObject(
  storagePath: string,
): Promise<VerifyCompanyLogoStorageObjectResult> {
  const path = storagePath.trim();
  if (!path) {
    return { ok: false, error: "missing_storage_path" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).download(path);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "download_failed" };
  }

  if (data.size === 0) {
    return { ok: false, error: "empty_object" };
  }

  return { ok: true, byteLength: data.size };
}

export async function cleanupStaleCompanyLogoFiles(params: {
  companyId: string;
  activeStoragePath: string;
}): Promise<void> {
  const stalePaths = selectStaleCompanyLogoCleanupPaths(params);
  if (stalePaths.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).remove(stalePaths);

  if (error) {
    console.warn("[company-logo-storage] cleanup failed", {
      companyId: params.companyId,
      activeStoragePath: params.activeStoragePath,
      stalePaths,
      message: error.message,
    });
  }
}

/** Best-effort cleanup after a successful DB persist of a companyId-based logo URL. */
export function scheduleCompanyLogoCleanupAfterPersist(params: {
  companyId: string;
  publicUrl: string;
}): void {
  const parsed = parseCompanyLogoStoragePathFromUrl(params.publicUrl);
  if (!parsed || parsed.isLegacyPath || parsed.companyId !== params.companyId.trim()) {
    return;
  }

  void cleanupStaleCompanyLogoFiles({
    companyId: params.companyId,
    activeStoragePath: parsed.bucketRelativePath,
  });
}
