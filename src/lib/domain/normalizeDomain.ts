import { normalizeCompanyIdentityFromWebsite } from "./socialPlatformWebsite";

/** Normalize a website URL to a canonical company identity (hostname, or host+path for social). */
export function normalizeDomainFromWebsite(website: string): string {
  return normalizeCompanyIdentityFromWebsite(website);
}

/** Alias used by sponsor import modules. */
export function normalizeDomain(websiteOrDomain: string): string {
  return normalizeDomainFromWebsite(websiteOrDomain);
}
