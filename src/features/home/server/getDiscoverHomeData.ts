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
};

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

  return {
    upcoming: selectUpcomingEditions(editions, { limit }),
    recentlyAdded: selectRecentlyAddedEditions(editions, { limit }),
  };
}
