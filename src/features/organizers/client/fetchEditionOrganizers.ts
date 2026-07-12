import type { EditionOrganizerAdminRow } from "@/src/features/organizers/server/eventOrganizerAdmin";

type EditionOrganizersResponse = {
  ok: boolean;
  error?: string;
  organizers?: EditionOrganizerAdminRow[];
};

export async function fetchEditionOrganizers(
  editionId: string,
): Promise<EditionOrganizerAdminRow[]> {
  const res = await fetch(`/api/admin/event-editions/${editionId}/organizers`);
  const data = (await res.json()) as EditionOrganizersResponse;

  if (!res.ok || !data.ok || !Array.isArray(data.organizers)) {
    throw new Error(data.error ?? "Failed to load organizers.");
  }

  return data.organizers;
}
