import { createAdminClient } from "@/src/lib/supabase/admin";

export type PublicStats = {
  events: number;
  sponsors: number;
  sponsorships: number;
  eventCities: number;
};

async function exactCount(
  supabase: ReturnType<typeof createAdminClient>,
  table: "event_editions" | "companies" | "event_sponsors",
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function distinctEventCityCount(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const { data, error } = await supabase
    .from("event_editions")
    .select("city_id")
    .not("city_id", "is", null);

  if (error) throw new Error(error.message);

  const cities = new Set(
    (data ?? [])
      .map((row) => row.city_id as string | null)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  return cities.size;
}

/** Aggregate public homepage/catalog counts (row totals only, no row payloads). */
export async function getPublicStats(): Promise<PublicStats> {
  const supabase = createAdminClient();

  const [events, sponsors, sponsorships, eventCities] = await Promise.all([
    exactCount(supabase, "event_editions"),
    exactCount(supabase, "companies"),
    exactCount(supabase, "event_sponsors"),
    distinctEventCityCount(supabase),
  ]);

  return { events, sponsors, sponsorships, eventCities };
}
