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

/**
 * Multi-tenant community / social hosts whose URLs must NOT become a company
 * identity key. A bare host here (e.g. `discord.com`) would silently merge
 * unrelated entities, so these resolve to "no identity" (null domain) instead.
 */
function matchesNonIdentityPlatform(host: string, pathname: string): boolean {
  const path = normalizePathname(pathname);

  switch (host) {
    case "discord.com":
    case "discordapp.com":
    case "discord.gg":
    case "instagram.com":
    case "tiktok.com":
    case "github.com":
      return true;
    case "linkedin.com":
      // Company pages keep a path-aware identity; personal profiles and the
      // bare host do not.
      return !path.startsWith("/company/");
    case "t.me":
    case "telegram.me":
      // B1: only invite/group links are non-identity; t.me/{handle} keeps its
      // existing path-aware identity.
      return path.startsWith("/+") || path.startsWith("/joinchat/");
    default:
      return false;
  }
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
 * Resolution of a raw website into a company identity. Three outcomes:
 * - `domain`: a usable identity key (corporate host, or path-aware hosted page).
 * - `no_identity`: a valid URL on a multi-tenant community/social platform that
 *   must not become an identity key (domain should be stored as null).
 * - `unparseable`: empty or not a usable URL (treated as an invalid website).
 */
export type CompanyWebsiteIdentity =
  | { status: "domain"; domain: string }
  | { status: "no_identity" }
  | { status: "unparseable" };

export function resolveCompanyWebsiteIdentity(website: string): CompanyWebsiteIdentity {
  const trimmed = website.trim();
  if (trimmed === "") return { status: "unparseable" };

  const parsed = parseWebsiteUrl(trimmed);
  if (parsed) {
    const host = normalizeHost(parsed.hostname);
    if (!host) return { status: "unparseable" };

    if (matchesNonIdentityPlatform(host, parsed.pathname)) {
      return { status: "no_identity" };
    }

    if (matchesHostedPlatformPath(host, parsed.pathname)) {
      const path = normalizePathname(parsed.pathname);
      return { status: "domain", domain: `${host}${path}` };
    }

    return { status: "domain", domain: host };
  }

  const fallback = trimmed
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (fallback === "") return { status: "unparseable" };
  return { status: "domain", domain: fallback };
}

/** True when the website is a multi-tenant community/social URL with no company identity. */
export function isCommunityPlatformWebsite(website: string): boolean {
  return resolveCompanyWebsiteIdentity(website).status === "no_identity";
}

/**
 * Canonical company identity for matching and dedup.
 * Corporate sites: hostname only. Hosted platforms: hostname + pathname.
 * Returns "" for community/social URLs (no identity) and unparseable input.
 */
export function normalizeCompanyIdentityFromWebsite(website: string): string {
  const resolved = resolveCompanyWebsiteIdentity(website);
  return resolved.status === "domain" ? resolved.domain : "";
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
