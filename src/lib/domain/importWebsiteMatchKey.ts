import { resolveCompanyWebsiteIdentity } from "./hostedPlatformWebsite";

function parseWebsiteHostPath(website: string): { host: string; path: string } | null {
  const trimmed = website.trim();
  if (trimmed === "") return null;

  try {
    const withProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "") return null;

    let path = parsed.pathname.toLowerCase();
    if (path !== "/" && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    if (path === "/") {
      path = "";
    }

    return { host, path };
  } catch {
    return null;
  }
}

/** Stable key for clustering import rows on full no_identity URLs (not bare hosts). */
export function normalizeWebsiteClusterKey(website: string): string {
  const trimmed = website.trim();
  if (trimmed === "") return "";

  const identity = resolveCompanyWebsiteIdentity(trimmed);
  if (identity.status === "domain") {
    return `domain:${identity.domain}`;
  }

  const parsed = parseWebsiteHostPath(trimmed);
  if (!parsed) {
    return `website:${trimmed.toLowerCase()}`;
  }

  return `website:${parsed.host}${parsed.path}`;
}

/**
 * Canonical import matching key for no_identity company websites.
 * Returns null for domain identities, unparseable input, and bare multi-tenant hosts.
 */
export function importWebsiteMatchKey(website: string): string | null {
  const trimmed = website.trim();
  if (trimmed === "") return null;

  if (resolveCompanyWebsiteIdentity(trimmed).status !== "no_identity") {
    return null;
  }

  const parsed = parseWebsiteHostPath(trimmed);
  if (!parsed || parsed.path === "") {
    return null;
  }

  return `website:${parsed.host}${parsed.path}`;
}
