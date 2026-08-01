export type EventSponsorCompany = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  website?: string | null;
  logo_url?: string | null;
  domain?: string | null;
  logo_source?: string | null;
  logo_status?: string | null;
  restricted_at?: string | null;
  event_brand_public_profile_approved_at?: string | null;
  /** ADR-005 EB4: server-resolved public role href (Series hub or Sponsor profile). */
  public_href?: string | null;
  city_id?: string | null;
  cities?: {
    name?: string | null;
    countries?: { name?: string | null } | null;
  } | null;
};

export type EventSponsorRow = {
  id: string | number;
  company_id?: string | null;
  tier_rank?: number | null;
  tier_label?: string | null;
  display_order?: number | null;
  companies?: EventSponsorCompany | null;
};
