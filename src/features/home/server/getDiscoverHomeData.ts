import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  buildEventCardKeywordPreview,
  type EventCardKeywordPreview,
} from "@/src/features/events/lib/eventCardKeywordPreview";
import { readEventDateRange } from "@/src/features/events/lib/readEventIsoDate";
import { mapPublicEditionRow } from "@/src/features/events/server/mapPublicEditionRow";
import { getPublicKeywordsForSeriesIds } from "@/src/features/events/server/seriesKeywordsPublic";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import {
  DISCOVER_MODULE_LIMIT,
  readEditionCreatedAt,
  selectRecentlyAddedEditions,
  selectUpcomingEditions,
  type DiscoverEditionCandidate,
} from "@/src/features/home/server/discoverEditionSelectors";
import { getEventEditions } from "@/src/lib/queries/events";
import {
  getSponsorCountsByEditionIds,
  readSponsorCountForEdition,
} from "@/src/lib/queries/companies";

export type DiscoverEditionSummary = PublicEditionSummary & {
  topicPreview: EventCardKeywordPreview | null;
  sponsorCount?: number;
};

export type DiscoverHomeData = {
  upcoming: DiscoverEditionSummary[];
  recentlyAdded: DiscoverEditionSummary[];
  calendarEvents: EventRecord[];
};

function readSeriesId(raw: unknown): string {
  if (raw === null || typeof raw !== "object") return "";
  const seriesId = (raw as { series_id?: unknown }).series_id;
  return typeof seriesId === "string" ? seriesId.trim() : "";
}

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
  const seriesIdByEditionId = new Map<string, string>();
  for (const row of rows) {
    const mapped = mapPublicEditionRow(row);
    if (!mapped) continue;
    seriesIdByEditionId.set(mapped.id, readSeriesId(row));
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
  const upcoming = selectUpcomingEditions(editions, { limit });
  const recentlyAdded = selectRecentlyAddedEditions(editions, { limit });
  const selectedEditions = [...upcoming, ...recentlyAdded];
  const selectedSeriesIds = selectedEditions.map(
    (edition) => seriesIdByEditionId.get(edition.id) ?? "",
  );
  const [keywordsBySeriesId, sponsorCountsByEditionId] = await Promise.all([
    getPublicKeywordsForSeriesIds(selectedSeriesIds),
    getSponsorCountsByEditionIds(recentlyAdded.map((edition) => edition.id)),
  ]);

  const withTopicPreview = (edition: PublicEditionSummary): DiscoverEditionSummary => {
    const seriesId = seriesIdByEditionId.get(edition.id) ?? "";
    return {
      ...edition,
      topicPreview: buildEventCardKeywordPreview(
        seriesId === "" ? [] : keywordsBySeriesId.get(seriesId),
      ),
    };
  };

  return {
    upcoming: upcoming.map(withTopicPreview),
    recentlyAdded: recentlyAdded.map((edition) => ({
      ...withTopicPreview(edition),
      sponsorCount: readSponsorCountForEdition(sponsorCountsByEditionId, edition.id),
    })),
    calendarEvents,
  };
}
