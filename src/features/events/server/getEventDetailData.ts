import { getCompaniesByEventEdition } from "@/src/lib/queries/companies";
import {
  getEventEditionDetail,
  getEventEditionDetailById,
} from "@/src/lib/queries/events";

export async function getEventDetailData(identifier: string) {
  const raw =
    (await getEventEditionDetail(identifier)) ?? (await getEventEditionDetailById(identifier));
  if (!raw) {
    return null;
  }

  const editionId =
    typeof raw.id === "string" && raw.id.trim() !== ""
      ? raw.id
      : raw.id !== undefined && raw.id !== null
        ? String(raw.id).trim()
        : null;

  if (editionId === null || editionId === "") {
    return { ...raw, event_sponsors: [] };
  }

  let eventSponsors: Awaited<ReturnType<typeof getCompaniesByEventEdition>> = [];
  try {
    eventSponsors = await getCompaniesByEventEdition(editionId);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] edition sponsors load failed:", error);
    }
  }

  return { ...raw, event_sponsors: eventSponsors };
}
