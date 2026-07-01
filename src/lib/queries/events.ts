import { createClient } from "@/src/lib/supabase/server";
import { CITY_PUBLIC_EMBED } from "@/src/lib/location/cityEmbedSelect";

/** Shared embed for `event_editions` list cards (kept in sync with list queries). */
export const EVENT_EDITION_LIST_SELECT = `
  *,
  event_series (*),
  cities (
    *,
    ${CITY_PUBLIC_EMBED}
  )
`;

const EVENT_SERIES_PUBLIC_SELECT =
  "id, name, slug, description, website_url, logo_url";

const EVENT_EDITION_DETAIL_SELECT = `
  *,
  event_series (*),
  cities (
    *,
    countries (
      *,
      regions (*)
    )
  ),
  venues (
    id,
    name,
    website_url,
    address_text,
    logo_url,
    archived_at
  ),
  event_organizers (
    *,
    organizers (*)
  )
`;

export async function getEventEditions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getEventEditionBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getEventEditionDetail(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_DETAIL_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getEventEditionDetailById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getEventsByCity(cityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .eq("city_id", cityId)
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getEventSeriesBySlug(slug: string) {
  const trimmed = slug.trim();
  if (trimmed === "") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_series")
    .select(EVENT_SERIES_PUBLIC_SELECT)
    .eq("slug", trimmed)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getEventSeriesById(id: string) {
  const trimmed = id.trim();
  if (trimmed === "") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_series")
    .select(EVENT_SERIES_PUBLIC_SELECT)
    .eq("id", trimmed)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getEventEditionsBySeriesId(
  seriesId: string,
  options?: { excludeEditionId?: string },
) {
  const trimmedSeriesId = seriesId.trim();
  if (trimmedSeriesId === "") return [];

  const supabase = await createClient();
  let query = supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .eq("series_id", trimmedSeriesId)
    .order("year", { ascending: false })
    .order("start_date", { ascending: false });

  const excludeEditionId = options?.excludeEditionId?.trim() ?? "";
  if (excludeEditionId !== "") {
    query = query.neq("id", excludeEditionId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
