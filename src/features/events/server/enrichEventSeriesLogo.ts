import { ingestCompanyLogoByDomain } from "@/src/features/companies/server/companyLogoIngest";
import { normalizeDomainFromWebsite } from "@/src/lib/domain/normalizeDomain";
import { createAdminClient } from "@/src/lib/supabase/admin";

/**
 * Best-effort logo fetch + Storage upload + DB update. **Never throws.**
 *
 * Intended to be invoked via Next.js `after()` so it runs after the API response is sent.
 */
export async function enrichEventSeriesLogo(
  seriesId: string,
  website: string,
): Promise<void> {
  try {
    const normalizedDomain = normalizeDomainFromWebsite(website);
    if (!normalizedDomain) {
      return;
    }

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("event_series")
      .select("logo_url")
      .eq("id", seriesId)
      .maybeSingle();

    const existingLogoUrl =
      typeof existing?.logo_url === "string" ? existing.logo_url.trim() : "";
    if (existingLogoUrl) {
      return;
    }

    const ingestResult = await ingestCompanyLogoByDomain(normalizedDomain, {
      storageNamespace: "event-series",
    });

    if (ingestResult.status === "ok" && ingestResult.logoUrl) {
      await supabase
        .from("event_series")
        .update({ logo_url: ingestResult.logoUrl })
        .eq("id", seriesId);
    }
  } catch {
    // Best-effort enrichment; failures must not affect the API response.
  }
}
