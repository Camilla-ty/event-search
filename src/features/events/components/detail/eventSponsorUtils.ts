import type { EventSponsorCompany, EventSponsorRow } from "./types";

function normalizeText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function companyFromSponsor(
  sponsor: EventSponsorRow,
): EventSponsorCompany | null {
  const company = sponsor.companies;
  if (company === null || company === undefined) return null;
  if (Array.isArray(company)) {
    const first = company[0];
    return first ?? null;
  }
  return company;
}

export function companyNameFromSponsor(sponsor: EventSponsorRow): string | null {
  return normalizeText(companyFromSponsor(sponsor)?.name);
}

export function companySlugFromSponsor(sponsor: EventSponsorRow): string | null {
  return normalizeText(companyFromSponsor(sponsor)?.slug);
}

export function effectiveCompanyId(sponsor: EventSponsorRow): string | null {
  const fk = sponsor.company_id;
  if (fk !== null && fk !== undefined && String(fk).trim() !== "") {
    return String(fk).trim();
  }
  const merged = companyFromSponsor(sponsor)?.id;
  if (merged !== null && merged !== undefined && String(merged).trim() !== "") {
    return String(merged).trim();
  }
  return null;
}

export function sponsorRouteSegment(sponsor: EventSponsorRow): string | null {
  const slug = companySlugFromSponsor(sponsor);
  if (slug) return slug;
  return effectiveCompanyId(sponsor);
}

export function sponsorDetailHref(segment: string): string {
  return `/sponsors/${encodeURIComponent(segment)}`;
}

export function relatedSponsorListLabel(sponsor: EventSponsorRow): string {
  const name = companyNameFromSponsor(sponsor);
  if (name) return name;
  return "Company";
}

export function isDisplayableSponsor(sponsor: EventSponsorRow): boolean {
  return effectiveCompanyId(sponsor) !== null;
}

export function filterDisplayableSponsors(sponsors: EventSponsorRow[]): EventSponsorRow[] {
  return sponsors.filter(isDisplayableSponsor);
}

function hostnameFromWebsite(website: string): string | null {
  const trimmed = website.trim();
  if (trimmed === "") return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.trim().replace(/^www\./i, "").toLowerCase();
    return hostname !== "" ? hostname : null;
  } catch {
    return null;
  }
}

type EventSponsorWebsiteFields = {
  website?: string | null;
  domain?: string | null;
};

/**
 * Public event-detail sponsor subtitle: website hostname, else domain, else hidden.
 */
export function formatEventSponsorWebsiteSubtitle(
  company: EventSponsorWebsiteFields | null | undefined,
): string | null {
  if (!company) return null;

  const website = company.website?.trim() ?? "";
  if (website !== "") {
    const hostname = hostnameFromWebsite(website);
    if (hostname) return hostname;
  }

  const domain = company.domain?.trim().toLowerCase() ?? "";
  return domain !== "" ? domain : null;
}
