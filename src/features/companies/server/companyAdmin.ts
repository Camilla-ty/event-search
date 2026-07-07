import { ingestManualCompanyLogoFromUrl } from "@/src/features/companies/server/companyLogoIngest";
import { scheduleCompanyLogoCleanupAfterPersist, uploadCompanyLogoBytes, verifyCompanyLogoStorageObject, normalizeStoredCompanyLogoUrl, storedCompanyLogoUrlFromUpload } from "@/src/features/companies/server/companyLogoStorage";
import {
  normalizeCompanyAliases,
  parseCompanyAliasesFromRow,
} from "@/src/lib/companies/companyAliases";
import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import {
  logoMetadataPatchForLogoClear,
  logoMetadataPatchForManualLogoStorage,
} from "@/src/lib/companies/logoMetadataPatch";
import { MANUAL_LOGO_IMPORT_FAILED_EDIT_WARNING } from "@/src/lib/companies/manualLogoIngestMessages";
import { validateCompanyLogoUpload } from "@/src/lib/companies/companyLogoUploadValidation";
import {
  companyMissingLogo,
  companyNeedsLogoReview,
  isHostedPlatformCompany,
  resolveCompanyWebsiteIdentity,
} from "@/src/lib/domain/hostedPlatformWebsite";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";
import { createAdminClient } from "@/src/lib/supabase/admin";

import { searchCompaniesAdmin, type AdminCompanySearchHit } from "./companyAdminSearch";

const COMPANY_ADMIN_SELECT =
  "id, name, slug, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error, short_description, description, city_id, created_at, aliases, status, merged_into_company_id, merged_at";

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
    status: typeof row.status === "string" ? row.status : "active",
    merged_into_company_id:
      typeof row.merged_into_company_id === "string" ? row.merged_into_company_id : null,
    merged_at: typeof row.merged_at === "string" ? row.merged_at : null,
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
  status: string;
  merged_into_company_id: string | null;
  merged_at: string | null;
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
}): Promise<{
  patch: Record<string, unknown>;
  warnings: string[];
  persistedLogoUrl?: string;
}> {
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
    const normalized = normalizeStoredCompanyLogoUrl(
      params.incomingLogoUrl,
      params.existing.id,
    );
    if (!normalized) {
      return { patch: {}, warnings };
    }
    if (normalized === normalizeStoredCompanyLogoUrl(existingLogo, params.existing.id)) {
      return { patch: {}, warnings };
    }
    return {
      patch: logoMetadataPatchForManualLogoStorage(normalized, params.existing.id),
      warnings,
      persistedLogoUrl: normalized,
    };
  }

  const ingest = await ingestManualCompanyLogoFromUrl(
    params.incomingLogoUrl,
    params.existing.id,
  );

  if (ingest.ok) {
    return {
      patch: logoMetadataPatchForManualLogoStorage(ingest.storageUrl, params.existing.id),
      warnings,
      persistedLogoUrl: ingest.storageUrl,
    };
  }

  warnings.push(MANUAL_LOGO_IMPORT_FAILED_EDIT_WARNING);
  return { patch: {}, warnings };
}

export type CompanyListFilter =
  | "all"
  | "social_website" // legacy filter id; admin UI label is "Hosted platform website"
  | "missing_logo"
  | "needs_logo_review";

export type ListCompaniesAdminOptions = {
  search?: string;
  filter?: CompanyListFilter;
};

function applyCompanyListFilter<T extends CompanyAdminRow>(
  companies: readonly T[],
  filter: CompanyListFilter,
): T[] {
  if (filter === "all") return [...companies];

  return companies.filter((company) => {
    switch (filter) {
      case "social_website":
        return isHostedPlatformCompany(company);
      case "missing_logo":
        return companyMissingLogo(company);
      case "needs_logo_review":
        return companyNeedsLogoReview(company);
      default:
        return true;
    }
  });
}

export function countSponsorLinksByCompany(
  links: readonly { company_id: unknown }[],
): Map<string, number> {
  const countByCompany = new Map<string, number>();
  for (const link of links) {
    const cid = link.company_id;
    if (typeof cid === "string") {
      countByCompany.set(cid, (countByCompany.get(cid) ?? 0) + 1);
    }
  }
  return countByCompany;
}

async function loadSponsorLinkCounts(): Promise<Map<string, number>> {
  const supabase = createAdminClient();
  const links = await fetchAllPaginatedSupabaseRows<{ company_id: unknown }>(
    async ({ from, to }) =>
      supabase.from("event_sponsors").select("company_id").range(from, to),
  );
  return countSponsorLinksByCompany(links);
}

function toCompanyListItems(
  companies: CompanyAdminRow[],
  countByCompany: Map<string, number>,
): CompanyListItem[] {
  return companies.map((company) => ({
    ...company,
    sponsor_link_count: countByCompany.get(company.id) ?? 0,
  }));
}

function searchHitsToCompanyListItems(
  hits: readonly AdminCompanySearchHit[],
  countByCompany: Map<string, number>,
): CompanyListItem[] {
  return hits.map((hit) => ({
    ...hit,
    sponsor_link_count: countByCompany.get(hit.id) ?? 0,
  }));
}

function isActiveAdminCompany(company: CompanyAdminRow): boolean {
  return company.status !== "merged";
}

export function isCompanyAdminEditable(company: CompanyAdminRow): boolean {
  return isActiveAdminCompany(company);
}

export const MERGED_COMPANY_READ_ONLY_MESSAGE = "Merged companies are read-only.";

function filterActiveAdminCompanies<T extends CompanyAdminRow>(companies: readonly T[]): T[] {
  return companies.filter(isActiveAdminCompany);
}

export async function listCompaniesAdmin(
  options?: ListCompaniesAdminOptions,
): Promise<CompanyListItem[]> {
  const filter = options?.filter ?? "all";
  const term = options?.search?.trim() ?? "";
  const countByCompany = await loadSponsorLinkCounts();

  if (term !== "") {
    const hits = await searchCompaniesAdmin({ query: term });
    const filtered = applyCompanyListFilter(filterActiveAdminCompanies(hits), filter);
    return searchHitsToCompanyListItems(filtered, countByCompany);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_ADMIN_SELECT)
    .eq("status", "active")
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
  const existing = await getCompanyAdminById(id);
  if (!existing) {
    throw new Error("Company not found.");
  }
  if (!isCompanyAdminEditable(existing)) {
    throw new Error(MERGED_COMPANY_READ_ONLY_MESSAGE);
  }

  const patch: Record<string, unknown> = {};
  const warnings: string[] = [];
  let persistedLogoUrl: string | undefined;

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.website !== undefined) {
    const website = input.website.trim();
    patch.website = website;
    const identity = resolveCompanyWebsiteIdentity(website);
    if (identity.status === "unparseable") {
      throw new Error("Invalid company website");
    }
    // Community/social URLs (no_identity) clear the domain identity key.
    patch.domain = identity.status === "domain" ? identity.domain : null;
  }
  if (input.aliases !== undefined) {
    const canonicalName =
      typeof patch.name === "string" ? patch.name : existing.name;
    patch.aliases = normalizeCompanyAliases(input.aliases, canonicalName);
  }
  if (input.logo_url !== undefined) {
    const incomingLogoUrl = input.logo_url?.trim() || null;
    const domainForLogo =
      (typeof patch.domain === "string" ? patch.domain : null) ?? existing.domain;

    const logoPatch = await resolveManualLogoPatch({
      existing,
      incomingLogoUrl,
      domainForLogo,
    });
    warnings.push(...logoPatch.warnings);
    Object.assign(patch, logoPatch.patch);
    persistedLogoUrl = logoPatch.persistedLogoUrl;
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

  if (persistedLogoUrl) {
    scheduleCompanyLogoCleanupAfterPersist({
      companyId: id,
      publicUrl: persistedLogoUrl,
    });
  }

  return { company: mapCompanyAdminRow(data as Record<string, unknown>), warnings };
}

export type UploadCompanyLogoFileInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export type UploadCompanyLogoFileAdminResult =
  | { ok: true; company: CompanyAdminRow }
  | { ok: false; status: 400 | 404 | 409 | 500; error: string };

export async function uploadCompanyLogoFileAdmin(
  companyId: string,
  input: UploadCompanyLogoFileInput,
): Promise<UploadCompanyLogoFileAdminResult> {
  const existing = await getCompanyAdminById(companyId);
  if (!existing) {
    return { ok: false, status: 404, error: "Company not found." };
  }
  if (!isCompanyAdminEditable(existing)) {
    return { ok: false, status: 409, error: MERGED_COMPANY_READ_ONLY_MESSAGE };
  }

  const validation = validateCompanyLogoUpload({
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.message };
  }

  const upload = await uploadCompanyLogoBytes({
    companyId,
    bytes: input.bytes,
    contentType: validation.contentType,
  });
  if (!upload.ok) {
    const message =
      upload.error === "file_too_large"
        ? "Logo must be 2 MB or smaller."
        : upload.error === "empty_file"
          ? "Logo file is empty."
          : "Logo upload failed.";
    return { ok: false, status: 500, error: message };
  }

  const verified = await verifyCompanyLogoStorageObject(upload.storagePath);
  if (!verified.ok) {
    return { ok: false, status: 500, error: "Uploaded logo could not be verified." };
  }

  const storedLogoUrl = storedCompanyLogoUrlFromUpload(upload);
  const supabase = createAdminClient();
  const patch = logoMetadataPatchForManualLogoStorage(storedLogoUrl, companyId);
  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", companyId)
    .select(COMPANY_ADMIN_SELECT)
    .single();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  scheduleCompanyLogoCleanupAfterPersist({
    companyId,
    publicUrl: storedLogoUrl,
  });

  return { ok: true, company: mapCompanyAdminRow(data as Record<string, unknown>) };
}
