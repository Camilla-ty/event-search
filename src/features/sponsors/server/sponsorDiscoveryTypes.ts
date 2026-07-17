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

/** Internal RPC-mapped event context (may include edition id). */
export type SponsorDiscoveryInternalEventContext = {
  slug: string;
  id: string | null;
  name: string | null;
};

/** Browser-safe event filter context for the active ?event= scope. */
export type SponsorDiscoveryPublicEventContext = {
  slug: string;
  name: string | null;
};

/** Internal row shape after RPC mapping (server-only; not sent to the browser). */
export type SponsorDiscoveryInternalRow = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  sponsored_edition_count: number;
  latest_activity_at: string | null;
  event_tier: SponsorDiscoveryEventTier | null;
};

/** Minimal public discovery row sent to the browser. */
export type SponsorDiscoveryPublicRow = {
  id: string;
  slug: string;
  name: string;
  href: string;
  website_label: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  sponsored_edition_count: number;
  event_tier_label: string | null;
};

export type SponsorDiscoveryInternalResult = {
  rows: SponsorDiscoveryInternalRow[];
  total: number;
  params: SponsorDiscoveryParams;
  eventContext: SponsorDiscoveryInternalEventContext | null;
  eventUnknown: boolean;
  pageWasClamped?: boolean;
};

export type SponsorDiscoveryResult = {
  rows: SponsorDiscoveryPublicRow[];
  total: number;
  params: SponsorDiscoveryParams;
  eventContext: SponsorDiscoveryPublicEventContext | null;
  eventUnknown: boolean;
  pageWasClamped?: boolean;
};
