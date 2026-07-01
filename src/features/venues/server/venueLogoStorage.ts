import { createAdminClient } from "@/src/lib/supabase/admin";
import { VENUE_LOGO_STORAGE_NAMESPACE } from "@/src/lib/venues/venueLogoPolicy";

import {
  COMPANY_LOGO_BUCKET,
  extensionForContentType,
  MAX_COMPANY_LOGO_SIZE_BYTES,
  verifyCompanyLogoStorageObject,
  type VerifyCompanyLogoStorageObjectResult,
} from "@/src/features/companies/server/companyLogoStorage";

export { extensionForContentType };

/** Known logo file extensions that may exist under a venue folder. */
export const VENUE_LOGO_STALE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
  "gif",
  "ico",
  "bin",
] as const;

const VENUE_ID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VENUE_LOGO_OBJECT_PATTERN = /^venues\/([^/]+)\/logo\.([a-z0-9]+)$/i;

export type ParsedVenueLogoStoragePath = {
  bucketRelativePath: string;
  venueId: string;
  extension: string;
};

function extractCompanyLogoBucketRelativePath(pathname: string): string | null {
  const markers = [
    `/storage/v1/object/public/${COMPANY_LOGO_BUCKET}/`,
    `/object/public/${COMPANY_LOGO_BUCKET}/`,
  ];

  for (const marker of markers) {
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex !== -1) {
      return pathname.slice(markerIndex + marker.length);
    }
  }

  return null;
}

export function isVenueIdLogoStorageSegment(segment: string): boolean {
  return VENUE_ID_SEGMENT_PATTERN.test(segment.trim());
}

/** Canonical path: venues/{venueId}/logo.{ext} */
export function venueLogoObjectPath(venueId: string, extension: string): string {
  const id = venueId.trim();
  const ext = extension.trim().toLowerCase();
  return `${VENUE_LOGO_STORAGE_NAMESPACE}/${id}/logo.${ext}`;
}

export function parseVenueLogoStoragePathFromUrl(
  url: string | null | undefined,
): ParsedVenueLogoStoragePath | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  let pathname: string;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    return null;
  }

  const bucketRelativePath = extractCompanyLogoBucketRelativePath(pathname);
  if (!bucketRelativePath) return null;

  const match = VENUE_LOGO_OBJECT_PATTERN.exec(bucketRelativePath);
  if (!match) return null;

  const venueId = match[1] ?? "";
  const extension = (match[2] ?? "").toLowerCase();
  if (!venueId || !extension || !isVenueIdLogoStorageSegment(venueId)) {
    return null;
  }

  return { bucketRelativePath, venueId, extension };
}

export function selectStaleVenueLogoCleanupPaths(params: {
  venueId: string;
  activeStoragePath: string;
}): string[] {
  const venueId = params.venueId.trim();
  const activePath = params.activeStoragePath.trim();
  if (!venueId || !activePath) return [];

  const activePrefix = `${VENUE_LOGO_STORAGE_NAMESPACE}/${venueId}/`;
  if (!activePath.startsWith(activePrefix)) return [];

  const stalePaths: string[] = [];
  for (const extension of VENUE_LOGO_STALE_EXTENSIONS) {
    const candidate = venueLogoObjectPath(venueId, extension);
    if (candidate !== activePath) {
      stalePaths.push(candidate);
    }
  }

  return stalePaths;
}

export function selectAllVenueLogoObjectPaths(venueId: string): string[] {
  const id = venueId.trim();
  if (!id) return [];

  return VENUE_LOGO_STALE_EXTENSIONS.map((extension) => venueLogoObjectPath(id, extension));
}

export type UploadVenueLogoBytesResult =
  | { ok: true; publicUrl: string; storagePath: string }
  | { ok: false; error: string };

export async function uploadVenueLogoBytes(params: {
  venueId: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<UploadVenueLogoBytesResult> {
  const venueId = params.venueId.trim();
  if (!venueId) {
    return { ok: false, error: "missing_venue_id" };
  }

  if (params.bytes.byteLength === 0) {
    return { ok: false, error: "empty_file" };
  }

  if (params.bytes.byteLength > MAX_COMPANY_LOGO_SIZE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  const extension = extensionForContentType(params.contentType);
  const storagePath = venueLogoObjectPath(venueId, extension);
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

export type VerifyVenueLogoStorageObjectResult = VerifyCompanyLogoStorageObjectResult;

export async function verifyVenueLogoStorageObject(
  storagePath: string,
): Promise<VerifyVenueLogoStorageObjectResult> {
  return verifyCompanyLogoStorageObject(storagePath);
}

export async function cleanupStaleVenueLogoFiles(params: {
  venueId: string;
  activeStoragePath: string;
}): Promise<void> {
  const stalePaths = selectStaleVenueLogoCleanupPaths(params);
  if (stalePaths.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).remove(stalePaths);

  if (error) {
    console.warn("[venue-logo-storage] cleanup failed", {
      venueId: params.venueId,
      activeStoragePath: params.activeStoragePath,
      stalePaths,
      message: error.message,
    });
  }
}

export async function cleanupAllVenueLogoFiles(venueId: string): Promise<void> {
  const paths = selectAllVenueLogoObjectPaths(venueId);
  if (paths.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).remove(paths);

  if (error) {
    console.warn("[venue-logo-storage] clear cleanup failed", {
      venueId,
      paths,
      message: error.message,
    });
  }
}

/** Best-effort cleanup after a successful DB persist of a venue logo URL. */
export function scheduleVenueLogoCleanupAfterPersist(params: {
  venueId: string;
  publicUrl: string | null;
}): void {
  const venueId = params.venueId.trim();
  if (!venueId) return;

  if (params.publicUrl === null) {
    void cleanupAllVenueLogoFiles(venueId);
    return;
  }

  const parsed = parseVenueLogoStoragePathFromUrl(params.publicUrl);
  if (!parsed || parsed.venueId !== venueId) {
    return;
  }

  void cleanupStaleVenueLogoFiles({
    venueId,
    activeStoragePath: parsed.bucketRelativePath,
  });
}
