import { normalizeCompanyIdentityFromWebsite } from "./hostedPlatformWebsite";

/** Normalize a website URL to a canonical company identity (hostname, or host+path for hosted platforms). */
export function normalizeDomainFromWebsite(website: string): string {
  return normalizeCompanyIdentityFromWebsite(website);
}

/** Alias used by sponsor import modules. */
export function normalizeDomain(websiteOrDomain: string): string {
  return normalizeDomainFromWebsite(websiteOrDomain);
}
