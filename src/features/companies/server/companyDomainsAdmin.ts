import { createAdminClient } from "@/src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CompanyDomainLinkError,
  ensureCompanyDomainFromImportLink,
  normalizeVerifiedCompanyDomainInput,
  verifiedCompanyDomainInputErrorMessage,
} from "@/src/lib/companies/linkCompanyDomainFromImport";

const COMPANY_DOMAIN_SELECT = "id, company_id, domain, is_primary, note, created_at";

export type CompanyDomainAdminRow = {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
  note: string | null;
  created_at: string | null;
};

function mapCompanyDomainRow(row: Record<string, unknown>): CompanyDomainAdminRow {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    domain: String(row.domain),
    is_primary: row.is_primary === true,
    note: typeof row.note === "string" ? row.note : null,
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

export function normalizeCompanyDomainNote(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** Update only company_domains.note for a row owned by the company (service-role only). */
export async function updateCompanyDomainNoteWithClient(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    domainRowId: string;
    note: string | null | undefined;
  },
): Promise<CompanyDomainAdminRow> {
  const note = normalizeCompanyDomainNote(params.note);

  const { data: existing, error: fetchError } = await supabase
    .from("company_domains")
    .select(COMPANY_DOMAIN_SELECT)
    .eq("id", params.domainRowId)
    .eq("company_id", params.companyId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) {
    throw new CompanyDomainAdminError(404, "Domain not found for this company.");
  }

  const { data: updated, error: updateError } = await supabase
    .from("company_domains")
    .update({ note })
    .eq("id", params.domainRowId)
    .eq("company_id", params.companyId)
    .select(COMPANY_DOMAIN_SELECT)
    .single();

  if (updateError) throw new Error(updateError.message);
  return mapCompanyDomainRow(updated as Record<string, unknown>);
}

export async function updateCompanyDomainNoteForAdmin(
  companyId: string,
  domainRowId: string,
  note: string | null | undefined,
): Promise<CompanyDomainAdminRow> {
  return updateCompanyDomainNoteWithClient(createAdminClient(), {
    companyId,
    domainRowId,
    note,
  });
}
