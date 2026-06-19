import { initialLogoMetadata } from "@/src/lib/companies/initialLogoMetadata";

export function logoMetadataPatchForManualLogoStorage(storageUrl: string): Record<string, unknown> {
  return {
    logo_url: storageUrl,
    logo_source: "manual",
    logo_status: "ok",
    logo_fetched_at: new Date().toISOString(),
    logo_fetch_error: null,
  };
}

/** Reset logo metadata when an admin clears the logo URL field. */
export function logoMetadataPatchForLogoClear(params: {
  domain: string | null | undefined;
}): Record<string, unknown> {
  const meta = initialLogoMetadata({
    logo_url: null,
    domain: params.domain,
  });

  return {
    logo_url: null,
    logo_source: meta.logo_source,
    logo_status: meta.logo_status,
    logo_fetched_at: null,
    logo_fetch_error: null,
  };
}
