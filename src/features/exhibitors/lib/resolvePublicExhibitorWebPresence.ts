import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";

export type PublicExhibitorWebPresence =
  | { kind: "website"; href: string; label: string }
  | { kind: "domain"; label: string };

/**
 * Prefer a clickable official website when `website` is present and parseable;
 * otherwise fall back to plain domain text (never promote domain to a link here).
 */
export function resolvePublicExhibitorWebPresence(company: {
  website?: string | null;
  domain?: string | null;
} | null | undefined): PublicExhibitorWebPresence | null {
  if (!company) return null;

  const website = company.website?.trim() ?? "";
  if (website !== "") {
    // Pass domain:null so an unparseable website does not silently become https://{domain}.
    const display = formatPublicCompanyWebsite({
      website,
      domain: null,
    });
    if (display) {
      const label =
        typeof company.domain === "string" && company.domain.trim() !== ""
          ? company.domain.trim().toLowerCase()
          : display.label;
      return { kind: "website", href: display.href, label };
    }
  }

  const domain = company.domain?.trim() ?? "";
  if (domain !== "") {
    return { kind: "domain", label: domain };
  }

  return null;
}
