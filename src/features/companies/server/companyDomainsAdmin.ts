import { createAdminClient } from "@/src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MERGED_COMPANY_READ_ONLY_MESSAGE } from "@/src/features/companies/server/companyAdmin";
import {
  CompanyDomainLinkError,
  ensureCompanyDomainFromImportLink,
  normalizeVerifiedCompanyDomainInput,
  verifiedCompanyDomainInputErrorMessage,
} from "@/src/lib/companies/linkCompanyDomainFromImport";
import { primaryWebsiteForIdentityPromotion } from "@/src/lib/domain/hostedPlatformWebsite";

const COMPANY_DOMAIN_SELECT = "id, company_id, domain, is_primary, created_at";

export type CompanyDomainAdminRow = {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
  created_at: string | null;
};

function mapCompanyDomainRow(row: Record<string, unknown>): CompanyDomainAdminRow {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    domain: String(row.domain),
    is_primary: row.is_primary === true,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export function sortCompanyDomainsForDisplay(
  domains: CompanyDomainAdminRow[],
): CompanyDomainAdminRow[] {
  return [...domains].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.domain.localeCompare(b.domain);
  });
}

/** Verified company domains for admin read-only display (service-role only). */
export async function listCompanyDomainsForAdmin(
  companyId: string,
): Promise<CompanyDomainAdminRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("company_domains")
    .select(COMPANY_DOMAIN_SELECT)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  return sortCompanyDomainsForDisplay(
    (data ?? []).map((row) => mapCompanyDomainRow(row as Record<string, unknown>)),
  );
}

export type AddCompanyDomainAdminResult =
  | { ok: true; status: "created"; domain: string }
  | { ok: true; status: "already_linked"; domain: string; message: string }
  | { ok: true; status: "same_as_primary"; domain: string; message: string };

/** Insert an additional verified domain for admin manual linking (service-role only). */
export async function addCompanyDomainWithClient(
  supabase: SupabaseClient,
  companyId: string,
  rawDomainInput: string,
): Promise<AddCompanyDomainAdminResult> {
  const normalized = normalizeVerifiedCompanyDomainInput(rawDomainInput);
  if (!normalized.ok) {
    throw new CompanyDomainLinkError(
      400,
      verifiedCompanyDomainInputErrorMessage(normalized.reason),
    );
  }

  const plan = await ensureCompanyDomainFromImportLink(supabase, {
    companyId,
    normalizedImportDomain: normalized.domain,
  });

  if (plan.action === "insert") {
    return { ok: true, status: "created", domain: plan.domain };
  }
  if (plan.action === "noop") {
    return {
      ok: true,
      status: "already_linked",
      domain: normalized.domain,
      message: "This domain is already linked to this company.",
    };
  }
  if (plan.action === "skip" && plan.reason === "same_as_primary") {
    return {
      ok: true,
      status: "same_as_primary",
      domain: normalized.domain,
      message: "This domain is already the company's primary identity.",
    };
  }

  throw new CompanyDomainLinkError(400, "Domain could not be linked.");
}

export async function addCompanyDomainForAdmin(
  companyId: string,
  rawDomainInput: string,
): Promise<AddCompanyDomainAdminResult> {
  return addCompanyDomainWithClient(createAdminClient(), companyId, rawDomainInput);
}

export class CompanyDomainAdminError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CompanyDomainAdminError";
    this.status = status;
  }
}

export type SetCompanyPrimaryDomainResult = {
  status: "updated" | "already_primary";
  company_id: string;
  website: string | null;
  domain: string | null;
  primary_domain_id: string;
};

function mapSetCompanyPrimaryDomainResult(raw: unknown): SetCompanyPrimaryDomainResult {
  if (!raw || typeof raw !== "object") {
    throw new CompanyDomainAdminError(500, "Invalid primary domain response.");
  }
  const row = raw as Record<string, unknown>;
  const status = row.status === "already_primary" ? "already_primary" : "updated";
  return {
    status,
    company_id: String(row.company_id),
    website: typeof row.website === "string" ? row.website : null,
    domain: typeof row.domain === "string" ? row.domain : null,
    primary_domain_id: String(row.primary_domain_id),
  };
}

export function parseSetCompanyPrimaryDomainRpcError(message: string): CompanyDomainAdminError {
  if (message.includes("company_not_found")) {
    return new CompanyDomainAdminError(404, "Company not found.");
  }
  if (message.includes("domain_not_found")) {
    return new CompanyDomainAdminError(404, "Domain not found for this company.");
  }
  if (message.includes("merged_read_only")) {
    return new CompanyDomainAdminError(409, MERGED_COMPANY_READ_ONLY_MESSAGE);
  }
  return new CompanyDomainAdminError(500, message);
}

/** Atomically promote an existing company_domains row to primary (service-role RPC). */
export async function setCompanyPrimaryDomainWithClient(
  supabase: SupabaseClient,
  companyId: string,
  domainRowId: string,
  options?: { currentWebsite?: string | null },
): Promise<SetCompanyPrimaryDomainResult> {
  const { data: domainRow, error: domainError } = await supabase
    .from("company_domains")
    .select("id, domain")
    .eq("id", domainRowId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (domainError) {
    throw new CompanyDomainAdminError(500, domainError.message);
  }
  if (!domainRow?.domain) {
    throw new CompanyDomainAdminError(404, "Domain not found for this company.");
  }

  let currentWebsite = options?.currentWebsite;
  if (currentWebsite === undefined) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("website")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) {
      throw new CompanyDomainAdminError(500, companyError.message);
    }
    currentWebsite = typeof company?.website === "string" ? company.website : null;
  }

  const matchKey = String(domainRow.domain);
  const website = primaryWebsiteForIdentityPromotion(currentWebsite, matchKey);

  const { data, error } = await supabase.rpc("set_company_primary_domain", {
    p_company_id: companyId,
    p_company_domain_id: domainRowId,
    p_website: website,
  });

  if (error) {
    throw parseSetCompanyPrimaryDomainRpcError(error.message);
  }

  return mapSetCompanyPrimaryDomainResult(data);
}

export async function setCompanyPrimaryDomainForAdmin(
  companyId: string,
  domainRowId: string,
): Promise<SetCompanyPrimaryDomainResult> {
  return setCompanyPrimaryDomainWithClient(createAdminClient(), companyId, domainRowId);
}
