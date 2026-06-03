import { createAdminClient } from "@/src/lib/supabase/admin";

import { fetchAndUploadLogoByDomain } from "./logo";

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
  short_description?: string | null;
  description?: string | null;
};

export function normalizeDomainFromWebsite(website: string): string {
  const value = website.trim().toLowerCase();
  if (!value) return "";

  try {
    const withProtocol =
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return value
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }
}

function buildShortDescription(name: string) {
  return `${name} partner profile`;
}

function buildDescription(name: string, website: string) {
  return `Auto-generated profile for ${name} (${website}).`;
}

/**
 * Insert a company row. **Never** touches logo storage — purely deterministic DB write.
 *
 * Logo enrichment is a separate, non-blocking step (`enrichCompanyLogo`) so a slow
 * provider, network timeout, or upload failure cannot affect company creation.
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

  const insertPayload: Record<string, unknown> = {
    name: trimmedName,
    domain: normalizedDomain,
    website: trimmedWebsite,
    city_id: input.city_id ?? null,
    slug: trimmedSlug,
    logo_url: null,
    short_description: buildShortDescription(trimmedName),
    description: buildDescription(trimmedName, trimmedWebsite),
  };

  const { data: inserted, error: insertError } = await supabase
    .schema("public")
    .from("companies")
    .insert(insertPayload)
    .select("id, name, slug, domain, logo_url, short_description, description")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted as CompanyRow;
}

/**
 * Best-effort logo fetch + DB update. **Never throws.**
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

    const logoUrl = await fetchAndUploadLogoByDomain(normalizedDomain);
    if (!logoUrl) {
      return;
    }

    const supabase = createAdminClient();
    await supabase.from("companies").update({ logo_url: logoUrl }).eq("id", companyId);
  } catch {
    // Best-effort enrichment; failures must not affect the API response.
  }
}
