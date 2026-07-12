import {
  listEventEditionsAdmin,
  type EventEditionListItem,
} from "@/src/features/events/server/eventEditionAdmin";
import type { EditionsListParams } from "@/src/features/events/server/editionsListParams";

export type AdminEditionsCollectionExtraFilters = {
  seriesId?: string;
  year?: number;
  search?: string;
};

export type AdminEditionsCollectionResult = {
  editions: EventEditionListItem[];
  total: number;
  params: EditionsListParams;
};

export async function buildAdminEditionsCollection(
  params: EditionsListParams,
  extra: AdminEditionsCollectionExtraFilters = {},
): Promise<AdminEditionsCollectionResult> {
  const editions = await listEventEditionsAdmin({
    missingWebsite: params.missingWebsite,
    missingDates: params.missingDates,
    missingCity: params.missingCity,
    seriesId: extra.seriesId,
    year: extra.year,
    search: extra.search,
  });

  return {
    editions,
    total: editions.length,
    params: {
      missingWebsite: params.missingWebsite,
      missingDates: params.missingDates,
      missingCity: params.missingCity,
    },
  };
}
