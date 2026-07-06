import { mapPublicEditionRow } from "@/src/features/events/server/mapPublicEditionRow";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import { getEventEditionsBySeriesId } from "@/src/lib/queries/events";

const DEFAULT_RELATED_LIMIT = 6;

export async function getRelatedEditions(params: {
  seriesId: string;
  excludeEditionId: string;
  limit?: number;
}): Promise<PublicEditionSummary[]> {
  const seriesId = params.seriesId.trim();
  const excludeEditionId = params.excludeEditionId.trim();
  if (seriesId === "" || excludeEditionId === "") return [];

  let rows: Awaited<ReturnType<typeof getEventEditionsBySeriesId>>;
  try {
    rows = await getEventEditionsBySeriesId(seriesId, {
      excludeEditionId,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] related editions load failed:", error);
    }
    return [];
  }

  const limit = params.limit ?? DEFAULT_RELATED_LIMIT;
  const editions: PublicEditionSummary[] = [];
  for (const row of rows) {
    const mapped = mapPublicEditionRow(row);
    if (mapped) editions.push(mapped);
    if (editions.length >= limit) break;
  }

  return editions;
}
