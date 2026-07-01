import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import { VENUE_LOGO_IMPORT_FAILED_WARNING } from "@/src/lib/companies/manualLogoIngestMessages";
import { VENUE_LOGO_STORAGE_NAMESPACE } from "@/src/lib/venues/venueLogoPolicy";

import { ingestManualVenueLogoFromUrl } from "./venueLogoIngest";
import {
  parseVenueLogoStoragePathFromUrl,
  verifyVenueLogoStorageObject,
} from "./venueLogoStorage";

export type { VenueLogoStorageNamespace } from "@/src/lib/venues/venueLogoPolicy";
export { VENUE_LOGO_STORAGE_NAMESPACE };

export type ResolveVenueManualLogoResult =
  | {
      ok: true;
      logo_url: string | null;
      applyPatch: boolean;
      /** Set when DB persist should trigger Storage cleanup (after success). */
      persistedLogoUrl?: string | null;
    }
  | { ok: false; warning: string };

export function isOwnedVenueLogoStorageUrl(
  url: string | null | undefined,
  venueId: string,
): boolean {
  const parsed = parseVenueLogoStoragePathFromUrl(url);
  return parsed !== null && parsed.venueId === venueId.trim();
}

export type VenueLogoBackfillClassification =
  | { action: "skip"; reason: "no_logo_url" | "already_owned_storage" | "foreign_storage_url" }
  | { action: "ingest" };

/** Classify a venue logo_url for the external-URL backfill job. */
export function classifyVenueLogoUrlForBackfill(
  logoUrl: string | null | undefined,
  venueId: string,
): VenueLogoBackfillClassification {
  const trimmed = logoUrl?.trim();
  if (!trimmed) {
    return { action: "skip", reason: "no_logo_url" };
  }

  if (isOwnedVenueLogoStorageUrl(trimmed, venueId)) {
    return { action: "skip", reason: "already_owned_storage" };
  }

  if (isCompanyLogoStorageUrl(trimmed)) {
    return { action: "skip", reason: "foreign_storage_url" };
  }

  return { action: "ingest" };
}

/** Resolve a pasted logo URL for venues. Venue logos are manual-only. */
export async function resolveVenueManualLogoUrl(params: {
  incomingLogoUrl: string | null;
  existingLogoUrl: string | null | undefined;
  venueId: string;
}): Promise<ResolveVenueManualLogoResult> {
  const existing = params.existingLogoUrl?.trim() || null;
  const incoming = params.incomingLogoUrl;
  const venueId = params.venueId.trim();

  if (incoming === null) {
    return {
      ok: true,
      logo_url: null,
      applyPatch: true,
      persistedLogoUrl: null,
    };
  }

  if (incoming === existing && isOwnedVenueLogoStorageUrl(existing, venueId)) {
    return { ok: true, logo_url: existing, applyPatch: false };
  }

  if (isCompanyLogoStorageUrl(incoming)) {
    if (!isOwnedVenueLogoStorageUrl(incoming, venueId)) {
      return { ok: false, warning: VENUE_LOGO_IMPORT_FAILED_WARNING };
    }

    const parsed = parseVenueLogoStoragePathFromUrl(incoming);
    if (!parsed) {
      return { ok: false, warning: VENUE_LOGO_IMPORT_FAILED_WARNING };
    }

    const verified = await verifyVenueLogoStorageObject(parsed.bucketRelativePath);
    if (!verified.ok) {
      return { ok: false, warning: VENUE_LOGO_IMPORT_FAILED_WARNING };
    }

    const applyPatch = incoming !== existing;
    return {
      ok: true,
      logo_url: incoming,
      applyPatch,
      ...(applyPatch ? { persistedLogoUrl: incoming } : {}),
    };
  }

  const ingest = await ingestManualVenueLogoFromUrl(incoming, venueId);
  if (ingest.ok) {
    return {
      ok: true,
      logo_url: ingest.storageUrl,
      applyPatch: true,
      persistedLogoUrl: ingest.storageUrl,
    };
  }

  return { ok: false, warning: VENUE_LOGO_IMPORT_FAILED_WARNING };
}
