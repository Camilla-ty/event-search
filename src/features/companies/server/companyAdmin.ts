import { normalizeDomainFromWebsite } from "@/src/features/companies/server/createCompanyWithLogo";
import { ingestManualCompanyLogoFromUrl } from "@/src/features/companies/server/companyLogoIngest";
import {
  companyAliasMatchesSearch,
  normalizeCompanyAliases,
  parseCompanyAliasesFromRow,
  resolveCompanySearchMatch,
} from "@/src/lib/companies/companyAliases";
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

const COMPANY_ADMIN_SELECT =
  "id, name, slug, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error, short_description, description, city_id, created_at, aliases";

function mapCompanyAdminRow(row: Record<string, unknown>): CompanyAdminRow {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    domain: typeof row.domain === "string" ? row.domain : null,
    website: typeof row.website === "string" ? row.website : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    logo_source: typeof row.logo_source === "string" ? row.logo_source : null,
    logo_status: typeof row.logo_status === "string" ? row.logo_status : null,
    logo_fetched_at: typeof row.logo_fetched_at === "string" ? row.logo_fetched_at : null,
    logo_fetch_error: typeof row.logo_fetch_error === "string" ? row.logo_fetch_error : null,
    short_description: typeof row.short_description === "string" ? row.short_description : null,
    description: typeof row.description === "string" ? row.description : null,
    city_id: typeof row.city_id === "string" ? row.city_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    aliases: parseCompanyAliasesFromRow(row.aliases),
  };
}

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
  aliases: string[];
};

export type CompanyListItem = CompanyAdminRow & {
  sponsor_link_count: number;
  matched_alias?: string | null;
};

export type UpdateCompanyAdminInput = {
  name?: string;
  slug?: string;
  website?: string;
  logo_url?: string | null;
  aliases?: string[];
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

async function searchCompaniesByPrimaryFields(term: string): Promise<CompanyAdminRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SELECT)
    .or(
      `name.ilike.%${term}%,slug.ilike.%${term}%,domain.ilike.%${term}%,website.ilike.%${term}%`,
    )
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCompanyAdminRow(row as Record<string, unknown>));
}

async function searchCompaniesByAliasOnly(
  term: string,
  excludeIds: ReadonlySet<string>,
): Promise<CompanyAdminRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SELECT)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const matches: CompanyAdminRow[] = [];
  for (const row of data ?? []) {
    const company = mapCompanyAdminRow(row as Record<string, unknown>);
    if (excludeIds.has(company.id)) continue;
    if (company.aliases.length === 0) continue;
    if (!companyAliasMatchesSearch(company, term)) continue;
    matches.push(company);
  }

  return matches;
}

async function loadSponsorLinkCounts(): Promise<Map<string, number>> {
  const supabase = createAdminClient();
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
  return countByCompany;
}

function toCompanyListItems(
  companies: CompanyAdminRow[],
  countByCompany: Map<string, number>,
  searchTerm?: string,
): CompanyListItem[] {
  const term = searchTerm?.trim() ?? "";
  return companies.map((company) => {
    const matched_alias =
      term !== "" ? resolveCompanySearchMatch(company, term).matched_alias : null;
    return {
      ...company,
      sponsor_link_count: countByCompany.get(company.id) ?? 0,
      ...(term !== "" ? { matched_alias } : {}),
    };
  });
}

export async function listCompaniesAdmin(
  options?: ListCompaniesAdminOptions,
): Promise<CompanyListItem[]> {
  const filter = options?.filter ?? "all";
  const term = options?.search?.trim() ?? "";
  const countByCompany = await loadSponsorLinkCounts();

  if (term !== "") {
    const primaryMatches = await searchCompaniesByPrimaryFields(term);
    const filteredPrimary = applyCompanyListFilter(primaryMatches, filter);
    const primaryIds = new Set(filteredPrimary.map((company) => company.id));
    const aliasMatches = applyCompanyListFilter(
      await searchCompaniesByAliasOnly(term, primaryIds),
      filter,
    );
    return toCompanyListItems([...filteredPrimary, ...aliasMatches], countByCompany, term);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SELECT)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const companies = applyCompanyListFilter(
    (data ?? []).map((row) => mapCompanyAdminRow(row as Record<string, unknown>)),
    filter,
  );
  if (companies.length === 0) return [];

  return toCompanyListItems(companies, countByCompany);
}

export async function getCompanyAdminById(id: string): Promise<CompanyAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapCompanyAdminRow(data as Record<string, unknown>);
}

export async function updateCompanyAdmin(
  id: string,
  input: UpdateCompanyAdminInput,
): Promise<UpdateCompanyAdminResult> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};
  const warnings: string[] = [];
  let existingRow: CompanyAdminRow | null = null;

  const needsExistingRow = input.logo_url !== undefined || input.aliases !== undefined;

  if (needsExistingRow) {
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
  if (input.aliases !== undefined && existingRow) {
    const canonicalName =
      typeof patch.name === "string" ? patch.name : existingRow.name;
    patch.aliases = normalizeCompanyAliases(input.aliases, canonicalName);
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
    .select(COMPANY_ADMIN_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return { company: mapCompanyAdminRow(data as Record<string, unknown>), warnings };
}
