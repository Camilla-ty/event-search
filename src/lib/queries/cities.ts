import { createClient } from "@/src/lib/supabase/server";

import { CITY_PUBLIC_EMBED } from "@/src/lib/location/cityEmbedSelect";

const EVENT_EDITION_BY_CITY_SELECT = `
  *,
  event_series (*),
  cities (
    *,
    ${CITY_PUBLIC_EMBED}
  )
`;

/**
 * Edition rows filtered by city, embedding `city → country → region`.
 * Mirrors `getEventsByCity` in `events.ts` — keep selects aligned when changing shapes.
 */
export async function getEventsByCity(cityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_BY_CITY_SELECT)
    .eq("city_id", cityId)
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}
