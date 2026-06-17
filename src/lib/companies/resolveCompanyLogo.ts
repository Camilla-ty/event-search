import type { CompanyLogoFields, ResolvedCompanyLogo } from "@/src/lib/companies/logoTypes";

export function companyLogoMonogramLetter(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1).toUpperCase();
}

export function resolveCompanyLogo(company: CompanyLogoFields): ResolvedCompanyLogo {
  const storedLogoUrl = company.logo_url?.trim();
  if (storedLogoUrl) {
    return { kind: "image", src: storedLogoUrl };
  }

  return { kind: "monogram", letter: companyLogoMonogramLetter(company.name) };
}
