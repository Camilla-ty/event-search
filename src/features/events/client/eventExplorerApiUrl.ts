import { buildEventExplorerCollectionSearchParams } from "@/src/features/events/server/eventExplorerParams";
import type { EventExplorerParams } from "@/src/features/events/server/eventExplorerParams";

export function buildEventExplorerApiUrl(params: EventExplorerParams): string {
  const query = buildEventExplorerCollectionSearchParams(params).toString();
  return query !== "" ? `/api/events/explorer?${query}` : "/api/events/explorer";
}
