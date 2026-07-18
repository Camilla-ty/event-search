export type PublicMergedIntoSeries = {
  id: string;
  slug: string;
  name: string;
};

export type PublicEventSeriesSummary = {
  id: string;
  slug: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  lifecycle_status: string | null;
  merged_into_series: PublicMergedIntoSeries | null;
};

export type PublicEditionSummary = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  start_date: string | null;
  end_date: string | null;
  locationLabel: string;
  event_series: Pick<PublicEventSeriesSummary, "name" | "logo_url"> | null;
};
