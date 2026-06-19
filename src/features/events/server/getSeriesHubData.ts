import {
  mapPublicEditionRow,
  mapPublicEventSeries,
} from "@/src/features/events/server/mapPublicEditionRow";
import type {
  PublicEditionSummary,
  PublicEventSeriesSummary,
} from "@/src/features/events/types/publicEdition";
import {
  getEventEditionsBySeriesId,
  getEventSeriesById,
  getEventSeriesBySlug,
} from "@/src/lib/queries/events";

export type SeriesHubData = {
  series: PublicEventSeriesSummary;
  editions: PublicEditionSummary[];
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

  const rows = await getEventEditionsBySeriesId(series.id);
  const editions: PublicEditionSummary[] = [];
  for (const row of rows) {
    const mapped = mapPublicEditionRow(row);
    if (mapped) editions.push(mapped);
  }

  return { series, editions };
}
