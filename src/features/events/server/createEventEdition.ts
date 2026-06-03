import { createAdminClient } from "@/src/lib/supabase/admin";

export type CreateEventEditionInput = {
  series_id: string;
  year: number;
  name: string;
  slug: string;
  start_date: string;
  end_date: string;
  website_url: string;
  city_id: string;
};

export type EventEditionRow = {
  id: string;
  series_id: string;
  year: number;
  name: string;
  slug: string;
  start_date: string;
  end_date: string;
  website_url: string;
  city_id: string;
  created_at?: string | null;
};

/**
 * Insert a single `event_editions` row. Pure DB write — never touches OG/banner storage.
 */
export async function createEventEdition(
  input: CreateEventEditionInput,
): Promise<EventEditionRow> {
  const supabase = createAdminClient();

  const insertPayload: Record<string, unknown> = {
    series_id: input.series_id,
    year: input.year,
    name: input.name.trim(),
    slug: input.slug.trim(),
    start_date: input.start_date,
    end_date: input.end_date,
    website_url: input.website_url.trim(),
    city_id: input.city_id,
  };

  const { data: inserted, error: insertError } = await supabase
    .schema("public")
    .from("event_editions")
    .insert(insertPayload)
    .select(
      "id, series_id, year, name, slug, start_date, end_date, website_url, city_id, created_at",
    )
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted as EventEditionRow;
}
