export type EventSeriesKeywordSummary = {
  id: string;
  name: string;
  slug: string;
};

export type EventRecord = {
  id: string;
  slug?: string | null;
  name?: string | null;
  website_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  event_series?: {
    name?: string | null;
    logo_url?: string | null;
    website_url?: string | null;
  } | null;
  series_keywords?: readonly EventSeriesKeywordSummary[];
  cities?: {
    name?: string | null;
    states?: {
      name?: string | null;
    } | null;
    countries?: {
      name?: string | null;
    } | null;
  } | null;
  sponsor_count?: number;
  last_reviewed_at?: string | null;
};

export type EventFilters = {
  query: string;
  regions: string[];
  startDate: string;
  endDate: string;
  topics: string[];
};
