export type SponsorDiscoverySort = "activity" | "name" | "count" | "tier";

export type SponsorDiscoveryEventTier = {
  tier_rank: number | null;
  tier_label: string | null;
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
  event_tier: SponsorDiscoveryEventTier | null;
};
