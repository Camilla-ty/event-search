import { resolveCompanyLogoDomain } from "@/src/lib/companies/resolveCompanyLogoDomain";

/** Whether this company was successfully upgraded via the manual Brandfetch tool. */
export function companyHasBrandfetchLogo(company: {
  logo_source?: string | null;
  logo_status?: string | null;
  logo_url?: string | null;
}): boolean {
  const source = company.logo_source?.trim().toLowerCase() ?? "";
  const status = company.logo_status?.trim().toLowerCase() ?? "";
  const logoUrl = company.logo_url?.trim() ?? "";
  return source === "brandfetch" && status === "ok" && logoUrl !== "";
}

export function isManualCompanyLogo(logoSource: string | null | undefined): boolean {
  return (logoSource?.trim().toLowerCase() ?? "") === "manual";
}

export function isBrandfetchCompanyLogoSource(
  logoSource: string | null | undefined,
): boolean {
  return (logoSource?.trim().toLowerCase() ?? "") === "brandfetch";
}

export function canUpgradeCompanyBrandfetchLogo(company: {
  domain?: string | null;
  logo_source?: string | null;
  logo_status?: string | null;
  logo_url?: string | null;
}): boolean {
  if (isManualCompanyLogo(company.logo_source)) return false;
  if (companyHasBrandfetchLogo(company)) return false;
  return resolveCompanyLogoDomain(company.domain) !== null;
}
