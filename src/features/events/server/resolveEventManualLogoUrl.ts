import { ingestManualEntityLogoFromUrl } from "@/src/features/companies/server/companyLogoIngest";
import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import { EVENT_LOGO_IMPORT_FAILED_WARNING } from "@/src/lib/companies/manualLogoIngestMessages";

export type EventLogoStorageNamespace = "event-series" | "event-editions";

export type ResolveEventManualLogoResult =
  | { ok: true; logo_url: string | null; applyPatch: boolean }
  | { ok: false; warning: string };

/**
 * Resolve a pasted logo URL for event series/editions: clear, keep Storage URL, or ingest external URL.
 */
export async function resolveEventManualLogoUrl(params: {
  incomingLogoUrl: string | null;
  existingLogoUrl: string | null | undefined;
  entityId: string;
  storageNamespace: EventLogoStorageNamespace;
}): Promise<ResolveEventManualLogoResult> {
  const existing = params.existingLogoUrl?.trim() || null;
  const incoming = params.incomingLogoUrl;

  if (incoming === null) {
    return { ok: true, logo_url: null, applyPatch: true };
  }

  if (incoming === existing && isCompanyLogoStorageUrl(existing)) {
    return { ok: true, logo_url: existing, applyPatch: false };
  }

  if (isCompanyLogoStorageUrl(incoming)) {
    return {
      ok: true,
      logo_url: incoming,
      applyPatch: incoming !== existing,
    };
  }

  const ingest = await ingestManualEntityLogoFromUrl(
    incoming,
    params.entityId,
    params.storageNamespace,
  );

  if (ingest.ok) {
    return { ok: true, logo_url: ingest.storageUrl, applyPatch: true };
  }

  return { ok: false, warning: EVENT_LOGO_IMPORT_FAILED_WARNING };
}
