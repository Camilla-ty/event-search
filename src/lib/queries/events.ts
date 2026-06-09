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
