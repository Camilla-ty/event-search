import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";
import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";
import { getSiteUrl } from "@/src/lib/metadata/site";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

const SCHEMA_CONTEXT = "https://schema.org";

export type OrganizationJsonLdCityInput = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export type BuildOrganizationJsonLdInput = {
  name: string;
  slug?: string | null;
  id?: string | null;
  restricted_at?: string | null;
  /** Display-mapped logo URL; emitted only when absolute http(s). */
  logoUrl?: string | null;
  website?: string | null;
  domain?: string | null;
  /** Exact factual summary already shown in the page body. */
  description?: string | null;
  city?: OrganizationJsonLdCityInput | null;
  /** Override for tests; defaults to `getSiteUrl()`. */
  siteUrl?: URL;
};

export type OrganizationJsonLd = {
  "@context": typeof SCHEMA_CONTEXT;
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
  logo?: string;
  sameAs?: string | string[];
  description?: string;
  address?: Record<string, unknown>;
};

function trimText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function absoluteUrlFromPath(path: string, siteUrl: URL): string {
  return new URL(path.replace(/^\//, ""), siteUrl).toString();
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildAddress(
  city: OrganizationJsonLdCityInput | null | undefined,
): Record<string, unknown> | undefined {
  const locality = trimText(city?.city);
  const region = trimText(city?.state);
  const country = trimText(city?.country);

  if (locality === "" && region === "" && country === "") {
    return undefined;
  }

  const address: Record<string, unknown> = {
    "@type": "PostalAddress",
  };
  if (locality !== "") address.addressLocality = locality;
  if (region !== "") address.addressRegion = region;
  if (country !== "") address.addressCountry = country;
  return address;
}

/**
 * Builds schema.org Organization JSON-LD from anonymous-visible sponsor profile facts.
 * Returns null when name/path are missing or the company is restricted.
 */
export function buildOrganizationJsonLd(
  input: BuildOrganizationJsonLdInput,
): OrganizationJsonLd | null {
  if (isCompanyRestricted(input)) return null;

  const name = trimText(input.name);
  if (name === "") return null;

  const path = buildSponsorProfilePath({ slug: input.slug, id: input.id });
  if (!path) return null;

  const siteUrl = input.siteUrl ?? getSiteUrl();
  const url = absoluteUrlFromPath(path, siteUrl);

  const organization: OrganizationJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": url,
    name,
    url,
  };

  const logoUrl = trimText(input.logoUrl);
  if (logoUrl !== "" && isAbsoluteHttpUrl(logoUrl)) {
    organization.logo = logoUrl;
  }

  const website = formatPublicCompanyWebsite({
    website: input.website,
    domain: input.domain,
  });
  if (website?.href && isAbsoluteHttpUrl(website.href)) {
    organization.sameAs = website.href;
  }

  const description = trimText(input.description);
  if (description !== "") {
    organization.description = description;
  }

  const address = buildAddress(input.city);
  if (address) {
    organization.address = address;
  }

  return organization;
}
