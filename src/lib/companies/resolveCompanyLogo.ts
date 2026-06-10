import { buildLogoDevImageUrl } from "@/src/lib/companies/logoDev";
import type { CompanyLogoFields, ResolvedCompanyLogo } from "@/src/lib/companies/logoTypes";

export function companyLogoMonogramLetter(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1).toUpperCase();
}

function normalizedDomain(domain: string | null | undefined): string {
  return domain?.trim().toLowerCase() ?? "";
}

function logoStatusAllowsLogoDev(logoStatus: string | null | undefined): boolean {
  const status = logoStatus?.trim().toLowerCase();
  return status === "ok" || status === "pending";
}

export function resolveCompanyLogo(
  company: CompanyLogoFields,
  options?: { logoDevSize?: number },
): ResolvedCompanyLogo {
  const storedLogoUrl = company.logo_url?.trim();
  if (storedLogoUrl) {
    return { kind: "image", src: storedLogoUrl, usesLogoDev: false };
  }

  const domain = normalizedDomain(company.domain);
  if (domain && logoStatusAllowsLogoDev(company.logo_status)) {
    const logoDevUrl = buildLogoDevImageUrl(domain, {
      size: options?.logoDevSize ?? 128,
    });
    if (logoDevUrl) {
      return { kind: "image", src: logoDevUrl, usesLogoDev: true };
    }
  }

  return { kind: "monogram", letter: companyLogoMonogramLetter(company.name) };
}
