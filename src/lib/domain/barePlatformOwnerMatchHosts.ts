/**
 * Platform hosts that can represent the platform company itself when imported as a
 * bare/root URL (e.g. https://www.coingecko.com/, https://github.com/).
 * Listing/profile paths on these hosts remain no_identity (or path-aware identity
 * for LinkedIn /company/ and YouTube channels) and must not use this fallback.
 *
 * Do not add generic identity platforms (x.com, medium.com, etc.)
 * without explicit approval.
 */
export const BARE_PLATFORM_OWNER_MATCH_HOSTS = new Set<string>([
  "coingecko.com",
  "coinmarketcap.com",
  "github.com",
  "linkedin.com",
  "youtube.com",
]);

export function isBarePlatformOwnerMatchHost(host: string): boolean {
  return BARE_PLATFORM_OWNER_MATCH_HOSTS.has(host.trim().toLowerCase());
}
