import { normalizeDomainFromWebsite } from "@/src/features/companies/server/createCompanyWithLogo";
import { ingestManualCompanyLogoFromUrl } from "@/src/features/companies/server/companyLogoIngest";
import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import {
  logoMetadataPatchForLogoClear,
  logoMetadataPatchForManualLogoStorage,
} from "@/src/lib/companies/logoMetadataPatch";
import { MANUAL_LOGO_IMPORT_FAILED_EDIT_WARNING } from "@/src/lib/companies/manualLogoIngestMessages";
import {
  companyMissingLogo,
  companyNeedsLogoReview,
  isSocialWebsiteCompany,
} from "@/src/lib/domain/socialPlatformWebsite";
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

export type UpdateCompanyAdminResult = {
  company: CompanyAdminRow;
  warnings: string[];
};

async function resolveManualLogoPatch(params: {
  existing: CompanyAdminRow;
  incomingLogoUrl: string | null;
  domainForLogo: string | null;
}): Promise<{ patch: Record<string, unknown>; warnings: string[] }> {
  const warnings: string[] = [];
  const existingLogo = params.existing.logo_url?.trim() || null;

  if (params.incomingLogoUrl === null) {
    return {
      patch: logoMetadataPatchForLogoClear({ domain: params.domainForLogo }),
      warnings,
    };
  }

  if (
    params.incomingLogoUrl === existingLogo &&
    isCompanyLogoStorageUrl(existingLogo)
  ) {
    return { patch: {}, warnings };
  }

  if (isCompanyLogoStorageUrl(params.incomingLogoUrl)) {
    return {
      patch: logoMetadataPatchForManualLogoStorage(params.incomingLogoUrl),
      warnings,
    };
  }

  const storageKey = params.domainForLogo?.trim() || params.existing.id;
  const ingest = await ingestManualCompanyLogoFromUrl(
    params.incomingLogoUrl,
    storageKey,
  );

  if (ingest.ok) {
    return {
      patch: logoMetadataPatchForManualLogoStorage(ingest.storageUrl),
      warnings,
    };
  }

  warnings.push(MANUAL_LOGO_IMPORT_FAILED_EDIT_WARNING);
  return { patch: {}, warnings };
}

export type CompanyListFilter =
  | "all"
  | "social_website"
  | "missing_logo"
  | "needs_logo_review";

export type ListCompaniesAdminOptions = {
  search?: string;
  filter?: CompanyListFilter;
};

function applyCompanyListFilter(
  companies: CompanyAdminRow[],
  filter: CompanyListFilter,
): CompanyAdminRow[] {
  if (filter === "all") return companies;

  return companies.filter((company) => {
    switch (filter) {
      case "social_website":
        return isSocialWebsiteCompany(company);
      case "missing_logo":
        return companyMissingLogo(company);
      case "needs_logo_review":
        return companyNeedsLogoReview(company);
      default:
        return true;
    }
  });
}

export async function listCompaniesAdmin(
  options?: ListCompaniesAdminOptions,
): Promise<CompanyListItem[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("companies")
    .select(
      "id, name, slug, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error, short_description, description, city_id, created_at",
    )
    .order("name", { ascending: true });

  const term = options?.search?.trim() ?? "";
  if (term !== "") {
    query = query.or(
      `name.ilike.%${term}%,slug.ilike.%${term}%,domain.ilike.%${term}%,website.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const filter = options?.filter ?? "all";
  const companies = applyCompanyListFilter((data ?? []) as CompanyAdminRow[], filter);
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
): Promise<UpdateCompanyAdminResult> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};
  const warnings: string[] = [];
  let existingRow: CompanyAdminRow | null = null;

  if (input.logo_url !== undefined) {
    existingRow = await getCompanyAdminById(id);
    if (!existingRow) {
      throw new Error("Company not found.");
    }
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
  if (input.logo_url !== undefined && existingRow) {
    const incomingLogoUrl = input.logo_url?.trim() || null;
    const domainForLogo =
      (typeof patch.domain === "string" ? patch.domain : null) ?? existingRow.domain;

    const logoPatch = await resolveManualLogoPatch({
      existing: existingRow,
      incomingLogoUrl,
      domainForLogo,
    });
    warnings.push(...logoPatch.warnings);
    Object.assign(patch, logoPatch.patch);
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
  return { company: data as CompanyAdminRow, warnings };
}
