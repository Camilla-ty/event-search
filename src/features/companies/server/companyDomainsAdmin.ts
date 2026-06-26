import { createAdminClient } from "@/src/lib/supabase/admin";

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
