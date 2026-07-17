/**
 * Platform hosts that can represent the platform company itself when imported as a
 * bare/root URL (e.g. https://www.coingecko.com/). Listing/profile paths on these
 * hosts remain no_identity and must not use this fallback.
 *
 * Do not add generic identity platforms (x.com, linkedin.com, medium.com, etc.)
 * without explicit approval.
 */
export const BARE_PLATFORM_OWNER_MATCH_HOSTS = new Set<string>([
  "coingecko.com",
  "coinmarketcap.com",
]);

export function isBarePlatformOwnerMatchHost(host: string): boolean {
  return BARE_PLATFORM_OWNER_MATCH_HOSTS.has(host.trim().toLowerCase());
}
