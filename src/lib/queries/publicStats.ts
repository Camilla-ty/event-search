import { createClient } from "@/src/lib/supabase/server";

export type PublicStats = {
  events: number;
  sponsors: number;
  organizers: number;
  eventCities: number;
};

type PublicCatalogStatsRow = {
  events?: unknown;
  sponsors?: unknown;
  organizers?: unknown;
  event_cities?: unknown;
};

function nonNegativeCount(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.trunc(raw));
}

/** Map a `public_catalog_stats` row into the public API shape. */
export function mapPublicCatalogStatsRow(
  row: PublicCatalogStatsRow | null | undefined,
): PublicStats {
  if (!row) {
    return { events: 0, sponsors: 0, organizers: 0, eventCities: 0 };
  }

  return {
    events: nonNegativeCount(row.events),
    sponsors: nonNegativeCount(row.sponsors),
    organizers: nonNegativeCount(row.organizers),
    eventCities: nonNegativeCount(row.event_cities),
  };
}

/**
 * Aggregate public homepage/catalog counts (row totals only, no row payloads).
 * Reads `public_catalog_stats` via the session client (ARC-001 Phase 3).
 */
export async function getPublicStats(): Promise<PublicStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_catalog_stats")
    .select("events, sponsors, organizers, event_cities")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapPublicCatalogStatsRow(data as PublicCatalogStatsRow | null);
}
