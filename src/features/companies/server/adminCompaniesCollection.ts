import type { AdminCompaniesListRow } from "@/src/features/companies/components/admin/AdminCompaniesListTable";
import {
  listCompaniesAdmin,
  type CompanyListItem,
} from "@/src/features/companies/server/companyAdmin";
import type { CompaniesListParams } from "@/src/features/companies/server/companiesListParams";

export type AdminCompaniesCollectionResult = {
  companies: AdminCompaniesListRow[];
  total: number;
  params: CompaniesListParams;
};

export function mapCompanyListItemToAdminRow(company: CompanyListItem): AdminCompaniesListRow {
  return {
    id: company.id,
    name: company.name,
    domain: company.domain,
    website: company.website,
    logo_url: company.logo_url,
    logo_source: company.logo_source,
    logo_status: company.logo_status,
    sponsor_link_count: company.sponsor_link_count,
    matched_alias: company.matched_alias ?? null,
  };
}

export async function buildAdminCompaniesCollection(
  params: CompaniesListParams,
): Promise<AdminCompaniesCollectionResult> {
  const companies = await listCompaniesAdmin({
    filter: params.filter,
    search: params.search !== "" ? params.search : undefined,
  });
  const rows = companies.map(mapCompanyListItemToAdminRow);

  return {
    companies: rows,
    total: rows.length,
    params: {
      filter: params.filter,
      search: params.search.trim(),
    },
  };
}
