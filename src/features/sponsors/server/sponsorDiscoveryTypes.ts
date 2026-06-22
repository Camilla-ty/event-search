export type SponsorDiscoverySort = "activity" | "name" | "count" | "tier";

/** Raw URL / searchParams input before normalization. */
export type SponsorDiscoverySearchInput = {
  q?: string | null;
  query?: string | null;
  event?: string | null;
  eventSlug?: string | null;
  sort?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

/** Normalized discovery params passed to sponsor_discovery_page RPC. */
export type SponsorDiscoveryParams = {
  query: string;
  eventSlug: string | null;
  sort: SponsorDiscoverySort;
  page: number;
  pageSize: number;
};

export type SponsorDiscoveryEventTier = {
  tier_rank: number | null;
  tier_label: string | null;
};

export type SponsorDiscoveryEventContext = {
  slug: string;
  id: string | null;
  name: string | null;
};

export type SponsorDiscoveryRow = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  short_description: string | null;
  location_label: string | null;
  sponsored_edition_count: number;
  latest_activity_at: string | null;
  /** Present only when an event slug filter is active and known. */
  event_tier: SponsorDiscoveryEventTier | null;
};

export type SponsorDiscoveryResult = {
  rows: SponsorDiscoveryRow[];
  total: number;
  params: SponsorDiscoveryParams;
  eventContext: SponsorDiscoveryEventContext | null;
  eventUnknown: boolean;
  /** True when the requested page was out of range and results use a clamped page. */
  pageWasClamped?: boolean;
};
