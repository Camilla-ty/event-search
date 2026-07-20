import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { readEventDateRange } from "@/src/features/events/lib/readEventIsoDate";
import { mapPublicEditionRow } from "@/src/features/events/server/mapPublicEditionRow";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import {
  DISCOVER_MODULE_LIMIT,
  readEditionCreatedAt,
  selectRecentlyAddedEditions,
  selectUpcomingEditions,
  type DiscoverEditionCandidate,
} from "@/src/features/home/server/discoverEditionSelectors";
import { getEventEditions } from "@/src/lib/queries/events";

export type DiscoverHomeData = {
  upcoming: PublicEditionSummary[];
  recentlyAdded: PublicEditionSummary[];
  calendarEvents: EventRecord[];
};

function mapEditionToEventRecord(edition: PublicEditionSummary): EventRecord {
  return {
    id: edition.id,
    // PublicEditionSummary does not carry series_id; this calendar preview never
    // filters by topic, so there is no series to propagate here.
    series_id: null,
    slug: edition.slug,
    name: edition.name,
    start_date: edition.start_date,
    end_date: edition.end_date,
    event_series: edition.event_series,
    cities: null,
  };
}

export async function getDiscoverHomeData(options?: {
  moduleLimit?: number;
}): Promise<DiscoverHomeData> {
  const limit = options?.moduleLimit ?? DISCOVER_MODULE_LIMIT;
  const rows = (await getEventEditions()) ?? [];

  const editions: DiscoverEditionCandidate[] = [];
  for (const row of rows) {
    const mapped = mapPublicEditionRow(row);
    if (!mapped) continue;
    editions.push({
      ...mapped,
      created_at: readEditionCreatedAt(
        typeof row === "object" && row !== null
          ? (row as { created_at?: unknown }).created_at
          : null,
      ),
    });
  }

  const calendarEvents = editions
    .filter((edition) => readEventDateRange(edition) !== null)
    .map(mapEditionToEventRecord);

  return {
    upcoming: selectUpcomingEditions(editions, { limit }),
    recentlyAdded: selectRecentlyAddedEditions(editions, { limit }),
    calendarEvents,
  };
}
