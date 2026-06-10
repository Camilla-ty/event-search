import { initialLogoMetadata } from "@/src/lib/companies/initialLogoMetadata";
import { normalizeDomainFromWebsite } from "@/src/lib/domain/normalizeDomain";
import { createAdminClient } from "@/src/lib/supabase/admin";

import { probeLogoDevByDomain } from "./logoProbe";

export { normalizeDomainFromWebsite };

export type CreateCompanyInput = {
  name: string;
  website: string;
  city_id: string | null;
  slug: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  short_description?: string | null;
  description?: string | null;
};

function buildShortDescription(name: string) {
  return `${name} partner profile`;
}

function buildDescription(name: string, website: string) {
  return `Auto-generated profile for ${name} (${website}).`;
}

/**
 * Insert a company row. **Never** downloads or rehosts logos — purely deterministic DB write.
 *
 * Logo enrichment is a separate, non-blocking step (`enrichCompanyLogo`) so a slow
 * provider or network timeout cannot affect company creation.
 */
export async function createCompany(input: CreateCompanyInput): Promise<CompanyRow> {
  const supabase = createAdminClient();
  const normalizedDomain = normalizeDomainFromWebsite(input.website);

  if (!normalizedDomain) {
    throw new Error("Invalid company website");
  }

  const trimmedName = input.name.trim();
  const trimmedWebsite = input.website.trim();
  const trimmedSlug = input.slug.trim();
  const logoMeta = initialLogoMetadata({ logo_url: null, domain: normalizedDomain });

  const insertPayload: Record<string, unknown> = {
    name: trimmedName,
    domain: normalizedDomain,
    website: trimmedWebsite,
    city_id: input.city_id ?? null,
    slug: trimmedSlug,
    logo_url: null,
    logo_source: logoMeta.logo_source,
    logo_status: logoMeta.logo_status,
    logo_fetched_at: null,
    logo_fetch_error: null,
    short_description: buildShortDescription(trimmedName),
    description: buildDescription(trimmedName, trimmedWebsite),
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

/**
 * Best-effort Logo.dev metadata probe. **Never throws.**
 *
 * Intended to be invoked via Next.js `after()` so it runs after the API response is sent.
 */
export async function enrichCompanyLogo(
  companyId: string,
  website: string,
): Promise<void> {
  try {
    const normalizedDomain = normalizeDomainFromWebsite(website);
    if (!normalizedDomain) {
      return;
    }

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("companies")
      .select("logo_url, logo_source")
      .eq("id", companyId)
      .maybeSingle();

    const existingLogoUrl =
      typeof existing?.logo_url === "string" ? existing.logo_url.trim() : "";
    const existingSource =
      typeof existing?.logo_source === "string" ? existing.logo_source.trim() : "";

    if (existingLogoUrl || existingSource === "manual") {
      return;
    }

    const probe = await probeLogoDevByDomain(normalizedDomain);

    await supabase
      .from("companies")
      .update({
        logo_source: "logo_dev",
        logo_status: probe.status,
        logo_fetched_at: new Date().toISOString(),
        logo_fetch_error: probe.error,
      })
      .eq("id", companyId);
  } catch {
    // Best-effort enrichment; failures must not affect the API response.
  }
}
