import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import { EVENT_LOGO_IMPORT_FAILED_WARNING } from "@/src/lib/companies/manualLogoIngestMessages";
import { EVENT_SERIES_LOGO_STORAGE_NAMESPACE } from "@/src/lib/events/eventLogoPolicy";

import { ingestManualEventSeriesLogoFromUrl } from "./eventSeriesLogoIngest";
import {
  parseEventSeriesLogoStoragePathFromUrl,
  verifyEventSeriesLogoStorageObject,
} from "./eventSeriesLogoStorage";

export type { EventLogoStorageNamespace } from "@/src/lib/events/eventLogoPolicy";
export { EVENT_SERIES_LOGO_STORAGE_NAMESPACE };

export type ResolveEventManualLogoResult =
  | {
      ok: true;
      logo_url: string | null;
      applyPatch: boolean;
      /** Set when DB persist should trigger Storage cleanup (after success). */
      persistedLogoUrl?: string | null;
    }
  | { ok: false; warning: string };

function isOwnedEventSeriesLogoStorageUrl(
  url: string | null | undefined,
  seriesId: string,
): boolean {
  const parsed = parseEventSeriesLogoStoragePathFromUrl(url);
  return parsed !== null && parsed.seriesId === seriesId.trim();
}

/** Resolve a pasted logo URL for event series. Event logos are manual-only. */
export async function resolveEventManualLogoUrl(params: {
  incomingLogoUrl: string | null;
  existingLogoUrl: string | null | undefined;
  seriesId: string;
}): Promise<ResolveEventManualLogoResult> {
  const existing = params.existingLogoUrl?.trim() || null;
  const incoming = params.incomingLogoUrl;
  const seriesId = params.seriesId.trim();

  if (incoming === null) {
    return {
      ok: true,
      logo_url: null,
      applyPatch: true,
      persistedLogoUrl: null,
    };
  }

  if (incoming === existing && isOwnedEventSeriesLogoStorageUrl(existing, seriesId)) {
    return { ok: true, logo_url: existing, applyPatch: false };
  }

  if (isCompanyLogoStorageUrl(incoming)) {
    if (!isOwnedEventSeriesLogoStorageUrl(incoming, seriesId)) {
      return { ok: false, warning: EVENT_LOGO_IMPORT_FAILED_WARNING };
    }

    const parsed = parseEventSeriesLogoStoragePathFromUrl(incoming);
    if (!parsed) {
      return { ok: false, warning: EVENT_LOGO_IMPORT_FAILED_WARNING };
    }

    const verified = await verifyEventSeriesLogoStorageObject(parsed.bucketRelativePath);
    if (!verified.ok) {
      return { ok: false, warning: EVENT_LOGO_IMPORT_FAILED_WARNING };
    }

    const applyPatch = incoming !== existing;
    return {
      ok: true,
      logo_url: incoming,
      applyPatch,
      ...(applyPatch ? { persistedLogoUrl: incoming } : {}),
    };
  }

  const ingest = await ingestManualEventSeriesLogoFromUrl(incoming, seriesId);
  if (ingest.ok) {
    return {
      ok: true,
      logo_url: ingest.storageUrl,
      applyPatch: true,
      persistedLogoUrl: ingest.storageUrl,
    };
  }

  return { ok: false, warning: EVENT_LOGO_IMPORT_FAILED_WARNING };
}
