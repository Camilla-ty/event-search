import { createAdminClient } from "@/src/lib/supabase/admin";

import type { ProposedImportCompany } from "@/src/features/sponsor-import/client/types";

type RowWithProposedCompanyId = {
  proposed_company_id: string | null;
};

export async function enrichImportRowsWithProposedCompanies<
  T extends RowWithProposedCompanyId,
>(rows: readonly T[]): Promise<Array<T & { proposed_company: ProposedImportCompany | null }>> {
  const companyIds = [
    ...new Set(
      rows
        .map((row) => row.proposed_company_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];

  if (companyIds.length === 0) {
    return rows.map((row) => ({ ...row, proposed_company: null }));
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain")
    .in("id", companyIds);

  if (error) {
    throw new Error(error.message);
  }

  const companyById = new Map<string, ProposedImportCompany>();
  for (const company of data ?? []) {
    companyById.set(String(company.id), {
      id: String(company.id),
      name: String(company.name),
      domain: typeof company.domain === "string" ? company.domain : null,
    });
  }

  return rows.map((row) => ({
    ...row,
    proposed_company: row.proposed_company_id
      ? (companyById.get(row.proposed_company_id) ?? null)
      : null,
  }));
}
