import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";

export async function fetchEditionLiveExhibitors(
  editionId: string,
): Promise<LiveExhibitorRow[]> {
  const res = await fetch(`/api/admin/event-editions/${editionId}/exhibitors`);
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    exhibitors?: LiveExhibitorRow[];
  };
  if (!res.ok || !data.ok || !Array.isArray(data.exhibitors)) {
    throw new Error(data.error ?? "Failed to load exhibitors.");
  }
  return data.exhibitors;
}
