import { getEventEditions } from "@/src/lib/queries/events";

export async function getHomeOverview() {
  const editions = await getEventEditions();

  return {
    eventEditionCount: editions?.length ?? 0,
  };
}
