export type CompanyLogoReviewFields = {
  website?: string | null;
  logo_url?: string | null;
  logo_source?: string | null;
};

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

function isSocialPlatformHostAndPath(host: string, pathname: string): boolean {
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

/** True when the website URL points at a known social / link-aggregator platform page. */
export function isSocialPlatformWebsite(website: string): boolean {
  const parsed = parseWebsiteUrl(website);
  if (!parsed) return false;

  const host = normalizeHost(parsed.hostname);
  return isSocialPlatformHostAndPath(host, parsed.pathname);
}

/**
 * Canonical company identity for matching and dedup.
 * Corporate sites: hostname only. Social platforms: hostname + pathname.
 */
export function normalizeCompanyIdentityFromWebsite(website: string): string {
  const trimmed = website.trim();
  if (trimmed === "") return "";

  const parsed = parseWebsiteUrl(trimmed);
  if (parsed) {
    const host = normalizeHost(parsed.hostname);
    if (!host) return "";

    if (isSocialPlatformHostAndPath(host, parsed.pathname)) {
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

export function companyMissingLogo(company: { logo_url?: string | null }): boolean {
  return !(company.logo_url?.trim());
}

/** Social website whose logo has not been manually curated by a researcher. */
export function companyNeedsLogoReview(company: CompanyLogoReviewFields): boolean {
  const website = company.website?.trim() ?? "";
  if (!isSocialPlatformWebsite(website)) return false;
  return company.logo_source?.trim().toLowerCase() !== "manual";
}
