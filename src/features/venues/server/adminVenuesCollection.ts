import { listVenuesAdmin, type VenueListItem } from "@/src/features/venues/server/venueAdmin";
import type { VenuesListParams } from "@/src/features/venues/server/venuesListParams";

export type AdminVenuesCollectionResult = {
  venues: VenueListItem[];
  total: number;
  params: VenuesListParams;
};

export async function buildAdminVenuesCollection(
  params: VenuesListParams,
): Promise<AdminVenuesCollectionResult> {
  const venues = await listVenuesAdmin({
    search: params.search !== "" ? params.search : undefined,
    includeArchived: params.includeArchived,
  });

  return {
    venues,
    total: venues.length,
    params: {
      search: params.search.trim(),
      includeArchived: params.includeArchived,
    },
  };
}
