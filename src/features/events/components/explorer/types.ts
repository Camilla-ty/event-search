export type EventRecord = {
  id: string;
  slug?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  event_series?: {
    name?: string | null;
    logo_url?: string | null;
  } | null;
  /** Edition logo, falling back to series logo when unset. */
  display_logo_url?: string | null;
  cities?: {
    name?: string | null;
    states?: {
      name?: string | null;
    } | null;
    countries?: {
      name?: string | null;
    } | null;
  } | null;
};

export type EventFilters = {
  query: string;
  industry: string;
  region: string;
  type: string;
  startDate: string;
  endDate: string;
  topic: string;
};
