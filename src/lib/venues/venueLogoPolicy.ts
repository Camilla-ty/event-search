export const VENUE_LOGO_STORAGE_NAMESPACE = "venues" as const;

export type VenueLogoStorageNamespace = typeof VENUE_LOGO_STORAGE_NAMESPACE;

export function isVenueLogoStorageNamespace(namespace: string): boolean {
  return namespace.trim() === VENUE_LOGO_STORAGE_NAMESPACE;
}
