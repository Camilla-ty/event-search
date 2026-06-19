import { createAdminClient } from "@/src/lib/supabase/admin";
import { EVENT_SERIES_LOGO_STORAGE_NAMESPACE } from "@/src/lib/events/eventLogoPolicy";

import {
  COMPANY_LOGO_BUCKET,
  extensionForContentType,
  MAX_COMPANY_LOGO_SIZE_BYTES,
  verifyCompanyLogoStorageObject,
  type VerifyCompanyLogoStorageObjectResult,
} from "@/src/features/companies/server/companyLogoStorage";

export { extensionForContentType };

/** Known logo file extensions that may exist under an event-series folder. */
export const EVENT_SERIES_LOGO_STALE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
  "gif",
  "ico",
  "bin",
] as const;

const SERIES_ID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_SERIES_LOGO_OBJECT_PATTERN =
  /^event-series\/([^/]+)\/logo\.([a-z0-9]+)$/i;

export type ParsedEventSeriesLogoStoragePath = {
  bucketRelativePath: string;
  seriesId: string;
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

export function isEventSeriesIdLogoStorageSegment(segment: string): boolean {
  return SERIES_ID_SEGMENT_PATTERN.test(segment.trim());
}

/** Event logos are manual-only. Canonical path: event-series/{seriesId}/logo.{ext} */
export function eventSeriesLogoObjectPath(seriesId: string, extension: string): string {
  const id = seriesId.trim();
  const ext = extension.trim().toLowerCase();
  return `${EVENT_SERIES_LOGO_STORAGE_NAMESPACE}/${id}/logo.${ext}`;
}

export function parseEventSeriesLogoStoragePathFromUrl(
  url: string | null | undefined,
): ParsedEventSeriesLogoStoragePath | null {
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

  const match = EVENT_SERIES_LOGO_OBJECT_PATTERN.exec(bucketRelativePath);
  if (!match) return null;

  const seriesId = match[1] ?? "";
  const extension = (match[2] ?? "").toLowerCase();
  if (!seriesId || !extension || !isEventSeriesIdLogoStorageSegment(seriesId)) {
    return null;
  }

  return { bucketRelativePath, seriesId, extension };
}

export function selectStaleEventSeriesLogoCleanupPaths(params: {
  seriesId: string;
  activeStoragePath: string;
}): string[] {
  const seriesId = params.seriesId.trim();
  const activePath = params.activeStoragePath.trim();
  if (!seriesId || !activePath) return [];

  const activePrefix = `${EVENT_SERIES_LOGO_STORAGE_NAMESPACE}/${seriesId}/`;
  if (!activePath.startsWith(activePrefix)) return [];

  const stalePaths: string[] = [];
  for (const extension of EVENT_SERIES_LOGO_STALE_EXTENSIONS) {
    const candidate = eventSeriesLogoObjectPath(seriesId, extension);
    if (candidate !== activePath) {
      stalePaths.push(candidate);
    }
  }

  return stalePaths;
}

export function selectAllEventSeriesLogoObjectPaths(seriesId: string): string[] {
  const id = seriesId.trim();
  if (!id) return [];

  return EVENT_SERIES_LOGO_STALE_EXTENSIONS.map((extension) =>
    eventSeriesLogoObjectPath(id, extension),
  );
}

export type UploadEventSeriesLogoBytesResult =
  | { ok: true; publicUrl: string; storagePath: string }
  | { ok: false; error: string };

export async function uploadEventSeriesLogoBytes(params: {
  seriesId: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<UploadEventSeriesLogoBytesResult> {
  const seriesId = params.seriesId.trim();
  if (!seriesId) {
    return { ok: false, error: "missing_series_id" };
  }

  if (params.bytes.byteLength === 0) {
    return { ok: false, error: "empty_file" };
  }

  if (params.bytes.byteLength > MAX_COMPANY_LOGO_SIZE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  const extension = extensionForContentType(params.contentType);
  const storagePath = eventSeriesLogoObjectPath(seriesId, extension);
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

export type VerifyEventSeriesLogoStorageObjectResult = VerifyCompanyLogoStorageObjectResult;

export async function verifyEventSeriesLogoStorageObject(
  storagePath: string,
): Promise<VerifyEventSeriesLogoStorageObjectResult> {
  return verifyCompanyLogoStorageObject(storagePath);
}

export async function cleanupStaleEventSeriesLogoFiles(params: {
  seriesId: string;
  activeStoragePath: string;
}): Promise<void> {
  const stalePaths = selectStaleEventSeriesLogoCleanupPaths(params);
  if (stalePaths.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).remove(stalePaths);

  if (error) {
    console.warn("[event-series-logo-storage] cleanup failed", {
      seriesId: params.seriesId,
      activeStoragePath: params.activeStoragePath,
      stalePaths,
      message: error.message,
    });
  }
}

export async function cleanupAllEventSeriesLogoFiles(seriesId: string): Promise<void> {
  const paths = selectAllEventSeriesLogoObjectPaths(seriesId);
  if (paths.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).remove(paths);

  if (error) {
    console.warn("[event-series-logo-storage] clear cleanup failed", {
      seriesId,
      paths,
      message: error.message,
    });
  }
}

/** Best-effort cleanup after a successful DB persist of an event-series logo URL. */
export function scheduleEventSeriesLogoCleanupAfterPersist(params: {
  seriesId: string;
  publicUrl: string | null;
}): void {
  const seriesId = params.seriesId.trim();
  if (!seriesId) return;

  if (params.publicUrl === null) {
    void cleanupAllEventSeriesLogoFiles(seriesId);
    return;
  }

  const parsed = parseEventSeriesLogoStoragePathFromUrl(params.publicUrl);
  if (!parsed || parsed.seriesId !== seriesId) {
    return;
  }

  void cleanupStaleEventSeriesLogoFiles({
    seriesId,
    activeStoragePath: parsed.bucketRelativePath,
  });
}
