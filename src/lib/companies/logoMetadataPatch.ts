import { initialLogoMetadata } from "@/src/lib/companies/initialLogoMetadata";

export function logoMetadataPatchForLogoUrlChange(params: {
  logo_url: string | null;
  domain: string | null | undefined;
}): Record<string, unknown> {
  if (params.logo_url) {
    return {
      logo_source: "manual",
      logo_status: "ok",
      logo_fetched_at: new Date().toISOString(),
      logo_fetch_error: null,
    };
  }

  const meta = initialLogoMetadata({
    logo_url: null,
    domain: params.domain,
  });

  return {
    logo_source: meta.logo_source,
    logo_status: meta.logo_status,
    logo_fetched_at: null,
    logo_fetch_error: null,
  };
}
