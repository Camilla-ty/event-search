export type FilterState = {
  query: string;
  eventSlug: string | null;
};

export type SponsorEventContext = {
  slug: string;
  name: string | null;
};

/** @deprecated Edition-scoped roster card; replaced by SponsorDiscoveryCard in PR4. */
export type SponsorCompany = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  industry?: string | null;
  location?: string | null;
  countries_active_count?: number | null;
  logo_url?: string | null;
  domain?: string | null;
  logo_source?: string | null;
  logo_status?: string | null;
};

/** @deprecated Edition-scoped roster row; replaced by SponsorDiscoveryRow in PR4. */
export type SponsorRecord = {
  id: string;
  tier_rank?: number | null;
  tier_label?: string | null;
  display_order?: number | null;
  companies?: SponsorCompany | null;
};
