import { toReviewedAtDateInputValue } from "@/src/features/events/lib/formatEventResearchMetadata";

export const CURRENT_YEAR = new Date().getFullYear();

export type EditionFormValues = {
  series_id: string;
  year: string;
  name: string;
  slug: string;
  website_url: string;
  start_date: string;
  end_date: string;
  city_id: string;
  venue_id: string;
  last_reviewed_at: string;
  primary_source_url: string;
};

export function buildEditionFormInitialValues(input: {
  series_id?: string;
  year?: number | string;
  name?: string;
  slug?: string;
  website_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  city_id?: string | null;
  venue_id?: string | null;
  last_reviewed_at?: string | null;
  primary_source_url?: string | null;
}): EditionFormValues {
  return {
    series_id: input.series_id ?? "",
    year: String(input.year ?? CURRENT_YEAR),
    name: input.name ?? "",
    slug: input.slug ?? "",
    website_url: input.website_url ?? "",
    start_date: input.start_date ?? "",
    end_date: input.end_date ?? "",
    city_id: input.city_id ?? "",
    venue_id: input.venue_id ?? "",
    last_reviewed_at: toReviewedAtDateInputValue(input.last_reviewed_at),
    primary_source_url: input.primary_source_url ?? "",
  };
}
