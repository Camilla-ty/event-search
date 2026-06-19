export type PublicEventSeriesSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
};

export type PublicEditionSummary = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  start_date: string | null;
  end_date: string | null;
  locationLabel: string;
  display_logo_url: string | null;
  event_series: Pick<PublicEventSeriesSummary, "name" | "logo_url"> | null;
};
