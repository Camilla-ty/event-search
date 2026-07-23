import { isBarePlatformOwnerMatchHost } from "./barePlatformOwnerMatchHosts";

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

/** ADR-002 Tier 2: social / directory reference pages with a stable path (selection tier). */
function matchesTier2SocialReferencePath(host: string, pathname: string): boolean {
  const pathOnly = pathname.split("?")[0] ?? pathname;
  const path = normalizePathname(pathOnly);
  if (path === "" || path === "/") return false;

  switch (host) {
    case "linkedin.com":
      return path.startsWith("/company/");
    case "facebook.com":
    case "fb.com":
    case "m.facebook.com":
      return true;
    case "linktr.ee":
    case "linktree.com":
      return true;
    default:
      return false;
  }
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

function matchesMirrorPlatformPath(host: string, pathname: string): boolean {
  if (host !== "mirror.xyz") return false;
  const path = normalizePathname(pathname);
  return path !== "" && path !== "/";
}

function isGitHubPagesHost(host: string): boolean {
  return host === "github.io" || host.endsWith(".github.io");
}

function isPublishingSubdomainHost(host: string): boolean {
  return host.endsWith(".substack.com") || host.endsWith(".medium.com");
}

function matchesHostedPlatformPath(host: string, pathname: string): boolean {
  return (
    matchesSocialPlatformPath(host, pathname) ||
    matchesMarketplacePlatformPath(host, pathname) ||
    matchesMirrorPlatformPath(host, pathname)
  );
}

/** ADR-002 Tier 3: hosted platform home (project lives on platform host). */
function matchesTier3HostedPlatformWebsite(host: string, pathname: string): boolean {
  if (matchesTier2SocialReferencePath(host, pathname)) return false;
  if (matchesHostedPlatformPath(host, pathname)) return true;
  if (isGitHubPagesHost(host)) return true;
  if (isPublishingSubdomainHost(host)) return true;
  return false;
}

/**
 * Social / hosted-platform / directory / link-in-bio URLs may be stored as the
 * company `website`, but must NOT become `companies.domain` identity keys.
 *
 * Multi-tenant hosts here would otherwise collapse to a shared bare-host domain
 * (e.g. `medium.com`, `crunchbase.com`) and silently merge unrelated companies,
 * so they resolve to "no identity" (null domain) while the full URL is preserved.
 */
const ALWAYS_NON_IDENTITY_HOSTS = new Set<string>([
  // Community / chat
  "discord.com",
  "discordapp.com",
  "discord.gg",
  "reddit.com",
  // Social (always no_identity)
  "instagram.com",
  "tiktok.com",
  // Code hosts
  "github.com",
  "gitlab.com",
  // Publishing / blogs (bare host is multi-tenant; *.medium.com / *.substack.com
  // subdomains remain distinct identities)
  "medium.com",
  "substack.com",
  // Startup / company directories
  "crunchbase.com",
  "wellfound.com",
  "angel.co",
  "coinmarketcap.com",
  "coingecko.com",
  "games.gg",
  // Link-in-bio aggregators
  "beacons.ai",
  "bio.site",
  "link3.to",
]);

/**
 * Hosts that DO carry a path-aware identity (e.g. `x.com/acme`) but whose BARE
 * host (no path) must not become an identity key.
 */
const BARE_HOST_NON_IDENTITY_HOSTS = new Set<string>([
  "x.com",
  "twitter.com",
  "facebook.com",
  "fb.com",
  "m.facebook.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

function isFacebookHost(host: string): boolean {
  return host === "facebook.com" || host === "fb.com" || host === "m.facebook.com";
}

/**
 * Facebook account identity: preserve path and identity-bearing `id` query.
 * Tracking params (utm_*, etc.) are dropped. Host variants canonicalize to facebook.com.
 *
 * Returns null when this URL is not a Facebook host (caller continues normal resolution).
 */
function resolveFacebookWebsiteIdentity(
  host: string,
  parsed: URL,
): CompanyWebsiteIdentity | null {
  if (!isFacebookHost(host)) return null;

  const path = normalizePathname(parsed.pathname);
  if (path === "" || path === "/") {
    return { status: "no_identity" };
  }

  if (path === "/profile.php") {
    const id = parsed.searchParams.get("id")?.trim() ?? "";
    if (!/^\d+$/.test(id)) {
      return { status: "no_identity" };
    }
    return { status: "domain", domain: `facebook.com/profile.php?id=${id}` };
  }

  // Vanity / people / pages paths — path only (no tracking query).
  return { status: "domain", domain: `facebook.com${path}` };
}

/**
 * HTTPS URL to store as companies.website when promoting a match key to Primary.
 * Keeps an existing full website when it already normalizes to the same identity.
 */
export function primaryWebsiteForIdentityPromotion(
  existingWebsite: string | null | undefined,
  matchKey: string,
): string {
  const key = matchKey.trim().toLowerCase();
  const existing = existingWebsite?.trim() ?? "";
  if (existing !== "" && normalizeCompanyIdentityFromWebsite(existing) === key) {
    if (/^https?:\/\//i.test(existing)) return existing;
    return `https://${existing}`;
  }
  return `https://${key}`;
}

function matchesNonIdentityPlatform(host: string, pathname: string): boolean {
  const path = normalizePathname(pathname);

  if (ALWAYS_NON_IDENTITY_HOSTS.has(host)) {
    return true;
  }

  if (BARE_HOST_NON_IDENTITY_HOSTS.has(host)) {
    // A path-bearing URL (x.com/acme) keeps its path-aware identity; the bare
    // host (x.com) does not.
    return path === "" || path === "/";
  }

  switch (host) {
    case "linkedin.com":
      // Company pages keep a path-aware identity; personal profiles and the
      // bare host do not.
      return !path.startsWith("/company/");
    case "t.me":
    case "telegram.me":
      // B1: only invite/group links are non-identity; t.me/{handle} keeps its
      // existing path-aware identity.
      return path.startsWith("/+") || path.startsWith("/joinchat/");
    case "mirror.xyz":
      return path === "" || path === "/";
    default:
      return false;
  }
}

/**
 * Bare/root URL on an allowlisted platform-owner host (CoinGecko, CoinMarketCap).
 * These hosts are otherwise always no_identity (token listing pages), but the
 * platform company itself may use the bare host as `companies.domain`.
 */
function isBarePlatformOwnerRootUrl(host: string, pathname: string): boolean {
  if (!isBarePlatformOwnerMatchHost(host)) return false;
  const path = normalizePathname(pathname);
  return path === "" || path === "/";
}

/** True when the website URL points at a known social / link-aggregator platform page. */
export function isSocialPlatformWebsite(website: string): boolean {
  const parsed = parseWebsiteUrl(website);
  if (!parsed) return false;

  const host = normalizeHost(parsed.hostname);
  if (isFacebookHost(host)) {
    const path = normalizePathname(parsed.pathname);
    return path !== "" && path !== "/";
  }
  return matchesSocialPlatformPath(host, parsed.pathname);
}

/** True when the website URL uses a hosted-platform identity (ADR-002 Tier 3). */
export function isHostedPlatformWebsite(website: string): boolean {
  const parsed = parseWebsiteUrl(website);
  if (!parsed) return false;

  const host = normalizeHost(parsed.hostname);
  return matchesTier3HostedPlatformWebsite(host, parsed.pathname);
}

/** True when a stored company identity key uses a hosted-platform host+path. */
export function isHostedPlatformIdentityKey(identity: string): boolean {
  const trimmed = identity.trim().toLowerCase();
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0) return false;

  const host = trimmed.slice(0, slashIndex);
  const pathAndQuery = trimmed.slice(slashIndex);
  const pathname = pathAndQuery.split("?")[0] ?? pathAndQuery;

  if (isFacebookHost(host) || host === "facebook.com") {
    return pathname !== "" && pathname !== "/";
  }

  return (
    matchesHostedPlatformPath(host, pathname) ||
    isGitHubPagesHost(host) ||
    isPublishingSubdomainHost(host)
  );
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

    // Facebook: path + identity-bearing query (profile.php?id=); never bare host.
    const facebookIdentity = resolveFacebookWebsiteIdentity(host, parsed);
    if (facebookIdentity) return facebookIdentity;

    // Platform-owner exception: bare/root CoinGecko/CoinMarketCap URLs may be
    // the platform company's identity key. Listing paths stay no_identity.
    if (isBarePlatformOwnerRootUrl(host, parsed.pathname)) {
      return { status: "domain", domain: host };
    }

    if (matchesNonIdentityPlatform(host, parsed.pathname)) {
      return { status: "no_identity" };
    }

    if (isGitHubPagesHost(host)) {
      return { status: "domain", domain: host };
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

export function isHostedPlatformCompany(company: { website?: string | null }): boolean {
  const website = company.website?.trim() ?? "";
  return website !== "" && isHostedPlatformWebsite(website);
}

export function companyMissingLogo(company: { logo_url?: string | null }): boolean {
  return !(company.logo_url?.trim());
}

/**
 * ADR-002 website selection tier (1 = official, 2 = social/directory/reference, 3 = hosted).
 * Lower number = higher priority when choosing a canonical website.
 */
export type CompanyWebsiteTier = 1 | 2 | 3;

export function classifyCompanyWebsiteTier(website: string): CompanyWebsiteTier | null {
  const trimmed = website.trim();
  if (trimmed === "") return null;

  const identity = resolveCompanyWebsiteIdentity(trimmed);
  if (identity.status === "unparseable") return null;

  const parsed = parseWebsiteUrl(trimmed);
  if (!parsed) return null;

  const host = normalizeHost(parsed.hostname);
  if (!host) return null;

  if (identity.status === "no_identity") {
    return 2;
  }

  if (matchesTier2SocialReferencePath(host, parsed.pathname)) {
    return 2;
  }

  if (matchesTier3HostedPlatformWebsite(host, parsed.pathname)) {
    return 3;
  }

  return 1;
}

/**
 * Within Tier 2, prefer path-stable social references over bare directory listings.
 * Returns 0 (higher priority) or 1 (lower priority).
 */
function tier2SubRank(website: string): number {
  const identity = resolveCompanyWebsiteIdentity(website);
  return identity.status === "domain" ? 0 : 1;
}

/**
 * Pick the canonical website from multiple candidates per ADR-002 tier priority:
 * official (1) > social/directory/reference (2) > hosted platform (3).
 */
export function selectCanonicalCompanyWebsite(urls: readonly string[]): string | null {
  let best: { url: string; tier: CompanyWebsiteTier; tier2Sub: number; index: number } | null =
    null;

  for (let index = 0; index < urls.length; index++) {
    const url = urls[index]?.trim() ?? "";
    if (url === "") continue;

    const tier = classifyCompanyWebsiteTier(url);
    if (tier === null) continue;

    const tier2Sub = tier === 2 ? tier2SubRank(url) : 0;

    if (
      best === null ||
      tier < best.tier ||
      (tier === best.tier &&
        (tier2Sub < best.tier2Sub ||
          (tier2Sub === best.tier2Sub && index < best.index)))
    ) {
      best = { url, tier, tier2Sub, index };
    }
  }

  return best?.url ?? null;
}

/** Non-official websites (Tier 2/3) need manual logo curation until a researcher sets one. */
export function companyNeedsLogoReview(company: CompanyLogoReviewFields): boolean {
  const website = company.website?.trim() ?? "";
  if (website === "") return false;

  const tier = classifyCompanyWebsiteTier(website);
  if (tier === null || tier === 1) return false;

  return company.logo_source?.trim().toLowerCase() !== "manual";
}
