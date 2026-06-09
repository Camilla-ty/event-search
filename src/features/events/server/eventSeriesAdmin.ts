import { createAdminClient } from "@/src/lib/supabase/admin";
import { slugify } from "@/src/lib/slugify";

export type EventSeriesRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  created_at: string;
};

export type CreateEventSeriesInput = {
  name: string;
  slug: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
};

export type UpdateEventSeriesInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
};

export type EventSeriesListItem = EventSeriesRow & {
  edition_count: number;
};

export async function listEventSeriesAdmin(search?: string): Promise<EventSeriesListItem[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("event_series")
    .select("id, name, slug, description, website_url, logo_url, created_at")
    .order("name", { ascending: true });

  const term = search?.trim() ?? "";
  if (term !== "") {
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const series = (data ?? []) as EventSeriesRow[];
  if (series.length === 0) return [];

  const { data: editionRows, error: editionError } = await supabase
    .from("event_editions")
    .select("series_id");

  if (editionError) throw new Error(editionError.message);

  const countBySeries = new Map<string, number>();
  for (const row of editionRows ?? []) {
    const sid = row.series_id;
    if (typeof sid === "string" && sid !== "") {
      countBySeries.set(sid, (countBySeries.get(sid) ?? 0) + 1);
    }
  }

  return series.map((item) => ({
    ...item,
    edition_count: countBySeries.get(item.id) ?? 0,
  }));
}

export async function getEventSeriesAdminById(
  id: string,
): Promise<EventSeriesRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_series")
    .select("id, name, slug, description, website_url, logo_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EventSeriesRow | null;
}

export async function createEventSeries(
  input: CreateEventSeriesInput,
): Promise<EventSeriesRow> {
  const supabase = createAdminClient();
  const payload = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: input.description?.trim() || null,
    website_url: input.website_url?.trim() || null,
    logo_url: input.logo_url?.trim() || null,
  };

  const { data, error } = await supabase
    .from("event_series")
    .insert(payload)
    .select("id, name, slug, description, website_url, logo_url, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as EventSeriesRow;
}

export async function updateEventSeries(
  id: string,
  input: UpdateEventSeriesInput,
): Promise<EventSeriesRow> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.website_url !== undefined) {
    patch.website_url = input.website_url?.trim() || null;
  }
  if (input.logo_url !== undefined) {
    patch.logo_url = input.logo_url?.trim() || null;
  }

  const { data, error } = await supabase
    .from("event_series")
    .update(patch)
    .eq("id", id)
    .select("id, name, slug, description, website_url, logo_url, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as EventSeriesRow;
}

export function defaultSeriesSlug(name: string): string {
  return slugify(name);
}
