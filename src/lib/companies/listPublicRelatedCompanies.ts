import { createClient } from "@/src/lib/supabase/server";
import {
  COMPANY_PUBLIC_SELECT,
  mapCompanyPublicRowForDisplay,
  type CompanyPublicRow,
} from "@/src/lib/queries/companies";
import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";

/**
 * Public Related Companies for a company profile.
 * Returns only active, non-restricted related companies (sorted by name).
 * Empty when none are publicly visible.
 */
export async function listPublicRelatedCompaniesForCompany(
  companyId: string,
): Promise<CompanyPublicRow[]> {
  const trimmed = companyId.trim();
  if (trimmed === "") return [];

  const supabase = await createClient();
  const { data: relations, error: relationsError } = await supabase
    .from("company_related_companies")
    .select("company_a_id, company_b_id")
    .or(`company_a_id.eq.${trimmed},company_b_id.eq.${trimmed}`);

  if (relationsError || !relations || relations.length === 0) {
    return [];
  }

  const relatedIds = [
    ...new Set(
      relations.map((row) => {
        const a = String(row.company_a_id);
        const b = String(row.company_b_id);
        return a === trimmed ? b : a;
      }),
    ),
  ];

  if (relatedIds.length === 0) return [];

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select(COMPANY_PUBLIC_SELECT)
    .in("id", relatedIds)
    .eq("status", "active")
    .is("restricted_at", null);

  if (companiesError || !companies) {
    return [];
  }

  return (companies as CompanyPublicRow[])
    .filter((row) => !isCompanyRestricted(row))
    .map(mapCompanyPublicRowForDisplay)
    .sort((a, b) => a.name.localeCompare(b.name));
}
