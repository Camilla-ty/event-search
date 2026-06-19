/** Event logos are manual-only. */
export const EVENT_SERIES_LOGO_STORAGE_NAMESPACE = "event-series" as const;

export type EventLogoStorageNamespace = typeof EVENT_SERIES_LOGO_STORAGE_NAMESPACE;

/** Returned when auto-enrich is attempted for event-series storage. */
export const EVENT_LOGO_AUTO_ENRICH_REJECTED_ERROR = "event_logos_manual_only" as const;

export function isEventLogoStorageNamespace(namespace: string): boolean {
  return namespace.trim() === EVENT_SERIES_LOGO_STORAGE_NAMESPACE;
}
