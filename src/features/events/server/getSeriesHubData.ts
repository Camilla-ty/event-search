import {
  mapPublicEditionRow,
  mapPublicEventSeries,
} from "@/src/features/events/server/mapPublicEditionRow";
import { loadSeriesParticipatedEvents } from "@/src/features/events/server/loadSeriesParticipatedEvents";
import { readCompanyProfileIdFromSeriesRow } from "@/src/features/events/server/sameBrandPublicLinks";
import { getPublicKeywordsForSeriesId } from "@/src/features/events/server/seriesKeywordsPublic";
import type {
  PublicEditionSummary,
  PublicEventSeriesSummary,
} from "@/src/features/events/types/publicEdition";
import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";
import type { SeriesParticipatedEvent } from "@/src/features/events/types/seriesParticipatedEvents";
import {
  getEventEditionsBySeriesId,
  getEventSeriesById,
  getEventSeriesBySlug,
} from "@/src/lib/queries/events";

export type SeriesHubData = {
  series: PublicEventSeriesSummary;
  editions: PublicEditionSummary[];
  topics: PublicKeywordSummary[];
  /**
   * Sponsor appearances of the same-brand Company (Participated Events prototype).
   * Empty when unlinked or no public rows.
   */
  participatedEvents: SeriesParticipatedEvent[];
};

export async function getSeriesHubData(
  identifier: string,
): Promise<SeriesHubData | null> {
  const trimmed = identifier.trim();
  if (trimmed === "") return null;

  const rawSeries =
    (await getEventSeriesBySlug(trimmed)) ?? (await getEventSeriesById(trimmed));
  const series = mapPublicEventSeries(rawSeries);
  if (!series) return null;

  const companyProfileId = readCompanyProfileIdFromSeriesRow(rawSeries);

  const [rows, topics, participatedEvents] = await Promise.all([
    getEventEditionsBySeriesId(series.id),
    getPublicKeywordsForSeriesId(series.id),
    loadSeriesParticipatedEvents(companyProfileId),
  ]);

  const editions: PublicEditionSummary[] = [];
  for (const row of rows) {
    const mapped = mapPublicEditionRow(row);
    if (mapped) editions.push(mapped);
  }

  return { series, editions, topics, participatedEvents };
}
