import { getCompaniesByEventEdition } from "@/src/lib/queries/companies";
import {
  getEventEditionDetail,
  getEventEditionDetailById,
} from "@/src/lib/queries/events";
import { mapEventEditionSeriesEmbedForDisplay } from "@/src/lib/storage/mapPublicLogoUrl";

export async function getEventDetailData(identifier: string) {
  const raw =
    (await getEventEditionDetail(identifier)) ?? (await getEventEditionDetailById(identifier));
  if (!raw) {
    return null;
  }

  const edition = mapEventEditionSeriesEmbedForDisplay(
    raw as Record<string, unknown>,
  ) as typeof raw;

  const editionId =
    typeof edition.id === "string" && edition.id.trim() !== ""
      ? edition.id
      : edition.id !== undefined && edition.id !== null
        ? String(edition.id).trim()
        : null;

  if (editionId === null || editionId === "") {
    return { ...edition, event_sponsors: [] };
  }

  let eventSponsors: Awaited<ReturnType<typeof getCompaniesByEventEdition>> = [];
  try {
    eventSponsors = await getCompaniesByEventEdition(editionId);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] edition sponsors load failed:", error);
    }
  }

  return { ...edition, event_sponsors: eventSponsors };
}
