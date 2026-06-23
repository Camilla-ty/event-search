import { initialLogoMetadata } from "@/src/lib/companies/initialLogoMetadata";
import { logoMetadataPatchForManualLogoStorage } from "@/src/lib/companies/logoMetadataPatch";
import { shouldAutoEnrichCompanyLogo } from "@/src/lib/companies/shouldAutoEnrichCompanyLogo";
import { normalizeDomainFromWebsite } from "@/src/lib/domain/normalizeDomain";
import { isHostedPlatformWebsite } from "@/src/lib/domain/socialPlatformWebsite";
import { createAdminClient } from "@/src/lib/supabase/admin";

import { companyLogoMetadataPatch } from "./companyLogoMetadata";
import { ingestCompanyLogoByDomain } from "./companyLogoIngest";
import { scheduleCompanyLogoCleanupAfterPersist } from "./companyLogoStorage";

export { normalizeDomainFromWebsite };

export type CreateCompanyInput = {
  name: string;
  website: string | null;
  city_id: string | null;
  slug: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  short_description?: string | null;
  description?: string | null;
};

function buildShortDescription(name: string) {
  return `${name} partner profile`;
}

function buildDescription(name: string, website: string | null) {
  if (website) {
    return `Auto-generated profile for ${name} (${website}).`;
  }
  return `Auto-generated profile for ${name}.`;
}

/**
 * Insert a company row. Logo fetch/upload is a separate non-blocking step (`enrichCompanyLogo`).
 */
export async function createCompany(input: CreateCompanyInput): Promise<CompanyRow> {
  const supabase = createAdminClient();
  const trimmedName = input.name.trim();
  const trimmedWebsite = input.website?.trim() ?? "";
  const trimmedSlug = input.slug.trim();
  const hasWebsite = trimmedWebsite !== "";

  let normalizedDomain: string | null = null;
  if (hasWebsite) {
    normalizedDomain = normalizeDomainFromWebsite(trimmedWebsite);
    if (!normalizedDomain) {
      throw new Error("Invalid company website");
    }
  }

  const isHostedPlatform = hasWebsite && isHostedPlatformWebsite(trimmedWebsite);
  const logoMeta = initialLogoMetadata({
    logo_url: null,
    domain: hasWebsite && !isHostedPlatform ? normalizedDomain : null,
  });

  const insertPayload: Record<string, unknown> = {
    name: trimmedName,
    domain: normalizedDomain,
    website: hasWebsite ? trimmedWebsite : null,
    city_id: input.city_id ?? null,
    slug: trimmedSlug,
    logo_url: null,
    logo_source: logoMeta.logo_source,
    logo_status: logoMeta.logo_status,
    logo_fetched_at: null,
    logo_fetch_error: null,
    short_description: buildShortDescription(trimmedName),
    description: buildDescription(trimmedName, hasWebsite ? trimmedWebsite : null),
  };

  const { data: inserted, error: insertError } = await supabase
    .schema("public")
    .from("companies")
    .insert(insertPayload)
    .select(
      "id, name, slug, domain, logo_url, logo_source, logo_status, short_description, description",
    )
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted as CompanyRow;
}

export async function applyManualCompanyLogoStorage(
  companyId: string,
  storageUrl: string,
): Promise<CompanyRow> {
  const supabase = createAdminClient();
  const patch = logoMetadataPatchForManualLogoStorage(storageUrl);

  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", companyId)
    .select(
      "id, name, slug, domain, logo_url, logo_source, logo_status, short_description, description",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CompanyRow;
}

/**
 * Best-effort logo fetch + Storage upload + DB update. **Never throws.**
 *
 * Intended to be invoked via Next.js `after()` so it runs after the API response is sent.
 */
export async function enrichCompanyLogo(
  companyId: string,
  website: string,
): Promise<void> {
  try {
    const trimmedWebsite = website.trim();
    if (!trimmedWebsite || isHostedPlatformWebsite(trimmedWebsite)) {
      return;
    }

    const normalizedDomain = normalizeDomainFromWebsite(trimmedWebsite);
    if (!normalizedDomain) {
      return;
    }

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("companies")
      .select("logo_url, logo_source")
      .eq("id", companyId)
      .maybeSingle();

    if (
      !shouldAutoEnrichCompanyLogo({
        logo_url: typeof existing?.logo_url === "string" ? existing.logo_url : null,
        logo_source: typeof existing?.logo_source === "string" ? existing.logo_source : null,
      })
    ) {
      return;
    }

    const ingestResult = await ingestCompanyLogoByDomain(normalizedDomain, {
      companyId,
    });
    const patch = companyLogoMetadataPatch(ingestResult);

    await supabase.from("companies").update(patch).eq("id", companyId);

    if (ingestResult.status === "ok" && ingestResult.logoUrl) {
      scheduleCompanyLogoCleanupAfterPersist({
        companyId,
        publicUrl: ingestResult.logoUrl,
      });
    }
  } catch {
    // Best-effort enrichment; failures must not affect the API response.
  }
}
