import {
  mapPublicEditionRow,
  mapPublicEventSeries,
} from "@/src/features/events/server/mapPublicEditionRow";
import { getPublicKeywordsForSeriesId } from "@/src/features/events/server/seriesKeywordsPublic";
import type {
  PublicEditionSummary,
  PublicEventSeriesSummary,
} from "@/src/features/events/types/publicEdition";
import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";
import {
  getEventEditionsBySeriesId,
  getEventSeriesById,
  getEventSeriesBySlug,
} from "@/src/lib/queries/events";

export type SeriesHubData = {
  series: PublicEventSeriesSummary;
  editions: PublicEditionSummary[];
  topics: PublicKeywordSummary[];
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

  const [rows, topics] = await Promise.all([
    getEventEditionsBySeriesId(series.id),
    getPublicKeywordsForSeriesId(series.id),
  ]);

  const editions: PublicEditionSummary[] = [];
  for (const row of rows) {
    const mapped = mapPublicEditionRow(row);
    if (mapped) editions.push(mapped);
  }

  return { series, editions, topics };
}
