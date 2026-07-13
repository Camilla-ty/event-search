import { buildEventExplorerApiUrl } from "@/src/features/events/client/eventExplorerApiUrl";
import type { EventExplorerPageResult } from "@/src/features/events/server/eventExplorerTypes";
import type { EventExplorerParams } from "@/src/features/events/server/eventExplorerParams";

type ExplorerApiError = {
  ok?: boolean;
  error?: string;
};

export async function fetchEventExplorerCollection(
  params: EventExplorerParams,
  signal?: AbortSignal,
): Promise<EventExplorerPageResult> {
  const response = await fetch(buildEventExplorerApiUrl(params), {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Failed to load events.";
    try {
      const payload = (await response.json()) as ExplorerApiError;
      if (typeof payload.error === "string" && payload.error.trim() !== "") {
        message = payload.error;
      }
    } catch {
      // Keep default message when error body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as EventExplorerPageResult;
}
