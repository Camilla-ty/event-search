import {
  getEventEditionDetail,
  getEventEditionDetailById,
} from "@/src/lib/queries/events";
import { mapEventEditionSeriesEmbedForDisplay } from "@/src/lib/storage/mapPublicLogoUrl";

/**
 * Public event edition shell for detail SSR.
 * Sponsor roster is loaded separately via `publicSponsorRoster` (Tier 1 page 1 + summaries)
 * so authenticated Tier 2+ identities never enter the initial RSC payload.
 */
export async function getEventDetailData(identifier: string) {
  const raw =
    (await getEventEditionDetail(identifier)) ?? (await getEventEditionDetailById(identifier));
  if (!raw) {
    return null;
  }

  const edition = mapEventEditionSeriesEmbedForDisplay(
    raw as Record<string, unknown>,
  ) as typeof raw;

  return edition;
}
