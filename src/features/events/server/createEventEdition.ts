import { createAdminClient } from "@/src/lib/supabase/admin";

export type CreateEventEditionInput = {
  series_id: string;
  year: number;
  name: string;
  slug: string;
  start_date?: string | null;
  end_date?: string | null;
  website_url?: string | null;
  city_id?: string | null;
};

export type EventEditionRow = {
  id: string;
  series_id: string | null;
  year: number;
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  website_url: string | null;
  logo_url: string | null;
  city_id: string | null;
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
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    website_url: input.website_url?.trim() || null,
    city_id: input.city_id ?? null,
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

export async function updateEventEdition(
  id: string,
  input: {
    name?: string;
    slug?: string;
    start_date?: string | null;
    end_date?: string | null;
    website_url?: string | null;
    city_id?: string | null;
  },
): Promise<EventEditionRow> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.start_date !== undefined) patch.start_date = input.start_date;
  if (input.end_date !== undefined) patch.end_date = input.end_date;
  if (input.website_url !== undefined) {
    patch.website_url = input.website_url?.trim() || null;
  }
  if (input.city_id !== undefined) patch.city_id = input.city_id;

  const { data, error } = await supabase
    .from("event_editions")
    .update(patch)
    .eq("id", id)
    .select(
      "id, series_id, year, name, slug, start_date, end_date, website_url, logo_url, city_id, created_at",
    )
    .single();

  if (error) throw new Error(error.message);
  return data as EventEditionRow;
}
