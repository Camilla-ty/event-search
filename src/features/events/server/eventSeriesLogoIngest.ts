import { MAX_COMPANY_LOGO_SIZE_BYTES } from "@/src/features/companies/server/companyLogoStorage";

import {
  uploadEventSeriesLogoBytes,
  verifyEventSeriesLogoStorageObject,
} from "./eventSeriesLogoStorage";

const FETCH_TIMEOUT_MS = 5000;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

type FetchedImage = {
  bytes: Uint8Array;
  contentType: string;
};

export type ManualEventSeriesLogoIngestResult =
  | { ok: true; storageUrl: string; storagePath: string }
  | { ok: false; error: string };

function isAllowedImageContentType(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_IMAGE_TYPES.includes(base);
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadExternalLogoImage(url: string): Promise<FetchedImage | null> {
  const response = await fetchWithTimeout(url.trim());
  if (!response || !response.ok) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!isAllowedImageContentType(contentType)) return null;

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const length = Number(contentLengthHeader);
    if (Number.isFinite(length) && length > MAX_COMPANY_LOGO_SIZE_BYTES) return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_COMPANY_LOGO_SIZE_BYTES) {
    return null;
  }

  return { bytes, contentType };
}

/**
 * Download a pasted logo URL, upload to event-series Storage, and verify the object.
 * Event logos are manual-only. Does not write to the database.
 */
export async function ingestManualEventSeriesLogoFromUrl(
  externalUrl: string,
  seriesId: string,
): Promise<ManualEventSeriesLogoIngestResult> {
  const trimmedUrl = externalUrl.trim();
  const trimmedSeriesId = seriesId.trim();
  if (!trimmedUrl) {
    return { ok: false, error: "empty_url" };
  }
  if (!trimmedSeriesId) {
    return { ok: false, error: "missing_series_id" };
  }

  const image = await downloadExternalLogoImage(trimmedUrl);
  if (!image) {
    return { ok: false, error: "download_failed" };
  }

  const upload = await uploadEventSeriesLogoBytes({
    seriesId: trimmedSeriesId,
    bytes: image.bytes,
    contentType: image.contentType,
  });
  if (!upload.ok) {
    return { ok: false, error: upload.error };
  }

  const verified = await verifyEventSeriesLogoStorageObject(upload.storagePath);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  return {
    ok: true,
    storageUrl: upload.publicUrl,
    storagePath: upload.storagePath,
  };
}
