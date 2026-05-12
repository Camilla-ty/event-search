export type EventRecord = {
  id: string;
  slug?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  event_series?: {
    name?: string | null;
  } | null;
  cities?: {
    name?: string | null;
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
};
