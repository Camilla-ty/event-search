export type CompanyLogoReviewFields = {
  website?: string | null;
  logo_url?: string | null;
  logo_source?: string | null;
};

const HOSTED_PLATFORM_SLUG_PATTERN = /^[a-z0-9._-]+$/;

function parseWebsiteUrl(website: string): URL | null {
  const trimmed = website.trim();
  if (trimmed === "") return null;

  try {
    const withProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.hostname === "") return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

function normalizePathname(pathname: string): string {
  let path = pathname.trim().toLowerCase();
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path;
}

function pathSegments(pathname: string): string[] {
  return normalizePathname(pathname).split("/").filter((segment) => segment !== "");
}

function isHostedPlatformSlug(segment: string): boolean {
  return HOSTED_PLATFORM_SLUG_PATTERN.test(segment);
}

/** Tier 1 social / link-aggregator paths (unchanged from pre-hosted refactor). */
function matchesSocialPlatformPath(host: string, pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path === "" || path === "/") return false;

  switch (host) {
    case "linkedin.com":
      return path.startsWith("/company/");
    case "youtube.com":
    case "m.youtube.com":
    case "youtu.be":
    case "x.com":
    case "twitter.com":
    case "facebook.com":
    case "fb.com":
    case "m.facebook.com":
    case "t.me":
    case "telegram.me":
    case "linktr.ee":
    case "linktree.com":
      return true;
    default:
      return false;
  }
}

/** Tier 1 marketplace collection paths. */
function matchesMarketplacePlatformPath(host: string, pathname: string): boolean {
  const segments = pathSegments(pathname);
  if (segments.length !== 2) return false;

  const [category, slug] = segments;
  if (!category || !slug || !isHostedPlatformSlug(slug)) return false;

  switch (host) {
    case "opensea.io":
      return category === "collection";
    case "magiceden.io":
      return category === "marketplace" || category === "collections";
    default:
      return false;
  }
}

function matchesHostedPlatformPath(host: string, pathname: string): boolean {
  return (
    matchesSocialPlatformPath(host, pathname) ||
    matchesMarketplacePlatformPath(host, pathname)
  );
}

/** True when the website URL points at a known social / link-aggregator platform page. */
export function isSocialPlatformWebsite(website: string): boolean {
  const parsed = parseWebsiteUrl(website);
  if (!parsed) return false;

  const host = normalizeHost(parsed.hostname);
  return matchesSocialPlatformPath(host, parsed.pathname);
}

/** True when the website URL uses a hosted-platform identity (social or Tier 1 marketplace). */
export function isHostedPlatformWebsite(website: string): boolean {
  const parsed = parseWebsiteUrl(website);
  if (!parsed) return false;

  const host = normalizeHost(parsed.hostname);
  return matchesHostedPlatformPath(host, parsed.pathname);
}

/** True when a stored company identity key uses a hosted-platform host+path. */
export function isHostedPlatformIdentityKey(identity: string): boolean {
  const trimmed = identity.trim().toLowerCase();
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0) return false;

  const host = trimmed.slice(0, slashIndex);
  const pathname = trimmed.slice(slashIndex);
  return matchesHostedPlatformPath(host, pathname);
}

/**
 * Canonical company identity for matching and dedup.
 * Corporate sites: hostname only. Hosted platforms: hostname + pathname.
 */
export function normalizeCompanyIdentityFromWebsite(website: string): string {
  const trimmed = website.trim();
  if (trimmed === "") return "";

  const parsed = parseWebsiteUrl(trimmed);
  if (parsed) {
    const host = normalizeHost(parsed.hostname);
    if (!host) return "";

    if (matchesHostedPlatformPath(host, parsed.pathname)) {
      const path = normalizePathname(parsed.pathname);
      return `${host}${path}`;
    }

    return host;
  }

  return trimmed
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function isSocialWebsiteCompany(company: { website?: string | null }): boolean {
  const website = company.website?.trim() ?? "";
  return website !== "" && isSocialPlatformWebsite(website);
}

export function isHostedPlatformCompany(company: { website?: string | null }): boolean {
  const website = company.website?.trim() ?? "";
  return website !== "" && isHostedPlatformWebsite(website);
}

export function companyMissingLogo(company: { logo_url?: string | null }): boolean {
  return !(company.logo_url?.trim());
}

/** Hosted-platform website whose logo has not been manually curated by a researcher. */
export function companyNeedsLogoReview(company: CompanyLogoReviewFields): boolean {
  const website = company.website?.trim() ?? "";
  if (!isHostedPlatformWebsite(website)) return false;
  return company.logo_source?.trim().toLowerCase() !== "manual";
}
