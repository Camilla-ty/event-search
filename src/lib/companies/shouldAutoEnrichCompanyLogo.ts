export type AutoEnrichLogoGuardFields = {
  logo_url?: string | null;
  logo_source?: string | null;
};

/** Whether domain-based auto logo ingest may run for this company row. */
export function shouldAutoEnrichCompanyLogo(company: AutoEnrichLogoGuardFields): boolean {
  const logoUrl = company.logo_url?.trim() ?? "";
  if (logoUrl !== "") return false;

  const source = company.logo_source?.trim().toLowerCase() ?? "";
  if (source === "manual") return false;

  return true;
}
