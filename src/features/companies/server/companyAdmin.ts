import { normalizeDomainFromWebsite } from "@/src/features/companies/server/createCompanyWithLogo";
import { logoMetadataPatchForLogoUrlChange } from "@/src/lib/companies/logoMetadataPatch";
import { createAdminClient } from "@/src/lib/supabase/admin";

export type CompanyAdminRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  logo_fetched_at: string | null;
  logo_fetch_error: string | null;
  short_description: string | null;
  description: string | null;
  city_id: string | null;
  created_at: string | null;
};

export type CompanyListItem = CompanyAdminRow & {
  sponsor_link_count: number;
};

export type UpdateCompanyAdminInput = {
  name?: string;
  slug?: string;
  website?: string;
  logo_url?: string | null;
  short_description?: string | null;
  description?: string | null;
  city_id?: string | null;
};

export async function listCompaniesAdmin(search?: string): Promise<CompanyListItem[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("companies")
    .select(
      "id, name, slug, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error, short_description, description, city_id, created_at",
    )
    .order("name", { ascending: true });

  const term = search?.trim() ?? "";
  if (term !== "") {
    query = query.or(
      `name.ilike.%${term}%,slug.ilike.%${term}%,domain.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const companies = (data ?? []) as CompanyAdminRow[];
  if (companies.length === 0) return [];

  const { data: links, error: linkError } = await supabase
    .from("event_sponsors")
    .select("company_id");

  if (linkError) throw new Error(linkError.message);

  const countByCompany = new Map<string, number>();
  for (const link of links ?? []) {
    const cid = link.company_id;
    if (typeof cid === "string") {
      countByCompany.set(cid, (countByCompany.get(cid) ?? 0) + 1);
    }
  }

  return companies.map((company) => ({
    ...company,
    sponsor_link_count: countByCompany.get(company.id) ?? 0,
  }));
}

export async function getCompanyAdminById(id: string): Promise<CompanyAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, slug, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error, short_description, description, city_id, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CompanyAdminRow | null;
}

export async function updateCompanyAdmin(
  id: string,
  input: UpdateCompanyAdminInput,
): Promise<CompanyAdminRow> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};
  let existingDomain: string | null = null;

  if (input.logo_url !== undefined && !(input.logo_url?.trim() || null)) {
    const existing = await getCompanyAdminById(id);
    existingDomain = existing?.domain ?? null;
  }

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.website !== undefined) {
    const website = input.website.trim();
    patch.website = website;
    const domain = normalizeDomainFromWebsite(website);
    if (!domain) {
      throw new Error("Invalid company website");
    }
    patch.domain = domain;
  }
  if (input.logo_url !== undefined) {
    const logoUrl = input.logo_url?.trim() || null;
    patch.logo_url = logoUrl;
    const domainForLogo =
      (typeof patch.domain === "string" ? patch.domain : null) ?? existingDomain;
    Object.assign(
      patch,
      logoMetadataPatchForLogoUrlChange({
        logo_url: logoUrl,
        domain: domainForLogo,
      }),
    );
  }
  if (input.short_description !== undefined) {
    patch.short_description = input.short_description?.trim() || null;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.city_id !== undefined) patch.city_id = input.city_id;

  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", id)
    .select(
      "id, name, slug, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error, short_description, description, city_id, created_at",
    )
    .single();

  if (error) throw new Error(error.message);
  return data as CompanyAdminRow;
}
