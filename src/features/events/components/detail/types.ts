export type EventSponsorCompany = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  website?: string | null;
  logo_url?: string | null;
  short_description?: string | null;
  description?: string | null;
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
  companies?: EventSponsorCompany | null;
};
