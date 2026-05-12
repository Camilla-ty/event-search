export type SponsorCompany = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  industry?: string | null;
  location?: string | null;
  countries_active_count?: number | null;
  logo_url?: string | null;
};

export type SponsorRecord = {
  id: string;
  tier_rank?: number | null;
  companies?: SponsorCompany | null;
};

export type FilterState = {
  query: string;
  industry: string;
};
