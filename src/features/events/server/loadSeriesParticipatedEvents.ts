import {
  mapSeriesParticipatedSponsorRow,
  sortSeriesParticipatedEvents,
} from "@/src/features/events/server/seriesParticipatedEvents";
import type { SeriesParticipatedEvent } from "@/src/features/events/types/seriesParticipatedEvents";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";
import { createClient } from "@/src/lib/supabase/server";

const PARTICIPATED_SPONSOR_SELECT = `
  id,
  tier_rank,
  tier_label,
  event_editions (
    ${EVENT_EDITION_LIST_SELECT}
  )
`;

/**
 * Editions where the same-brand Company appears in `event_sponsors`.
 * Empty when company id is missing or there are no publicly usable rows.
 */
export async function loadSeriesParticipatedEvents(
  companyProfileId: string | null | undefined,
): Promise<SeriesParticipatedEvent[]> {
  const id =
    typeof companyProfileId === "string" ? companyProfileId.trim() : "";
  if (id === "") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_sponsors")
    .select(PARTICIPATED_SPONSOR_SELECT)
    .eq("company_id", id);

  if (error || !data) return [];

  const items: SeriesParticipatedEvent[] = [];
  for (const row of data) {
    const mapped = mapSeriesParticipatedSponsorRow(row);
    if (mapped) items.push(mapped);
  }
  return sortSeriesParticipatedEvents(items);
}
