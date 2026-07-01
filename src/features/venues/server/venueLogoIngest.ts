import { MAX_COMPANY_LOGO_SIZE_BYTES } from "@/src/features/companies/server/companyLogoStorage";
import { normalizeManualLogoUploadMimeType } from "@/src/lib/companies/companyLogoUploadValidation";

import {
  uploadVenueLogoBytes,
  verifyVenueLogoStorageObject,
} from "./venueLogoStorage";

const FETCH_TIMEOUT_MS = 5000;

type FetchedImage = {
  bytes: Uint8Array;
  contentType: string;
};

export type ManualVenueLogoIngestResult =
  | { ok: true; storageUrl: string; storagePath: string }
  | { ok: false; error: string };

export function isAllowedVenueLogoIngestContentType(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalizeManualLogoUploadMimeType(base) !== null;
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
  if (!isAllowedVenueLogoIngestContentType(contentType)) return null;

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
 * Download a pasted logo URL, upload to venue Storage, and verify the object.
 * Does not write to the database.
 */
export async function ingestManualVenueLogoFromUrl(
  externalUrl: string,
  venueId: string,
): Promise<ManualVenueLogoIngestResult> {
  const trimmedUrl = externalUrl.trim();
  const trimmedVenueId = venueId.trim();
  if (!trimmedUrl) {
    return { ok: false, error: "empty_url" };
  }
  if (!trimmedVenueId) {
    return { ok: false, error: "missing_venue_id" };
  }

  const image = await downloadExternalLogoImage(trimmedUrl);
  if (!image) {
    return { ok: false, error: "download_failed" };
  }

  const upload = await uploadVenueLogoBytes({
    venueId: trimmedVenueId,
    bytes: image.bytes,
    contentType: image.contentType,
  });
  if (!upload.ok) {
    return { ok: false, error: upload.error };
  }

  const verified = await verifyVenueLogoStorageObject(upload.storagePath);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  return {
    ok: true,
    storageUrl: upload.publicUrl,
    storagePath: upload.storagePath,
  };
}
