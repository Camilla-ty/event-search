import type { AdminEditionsCollectionResult } from "@/src/features/events/server/adminEditionsCollection";
import { buildEditionsListSearchParams } from "@/src/features/events/server/editionsListParams";
import type { EditionsListParams } from "@/src/features/events/server/editionsListParams";

type EditionsApiError = {
  ok?: boolean;
  error?: string;
};

export function buildAdminEditionsApiUrl(params: EditionsListParams): string {
  const query = buildEditionsListSearchParams(params).toString();
  return query !== "" ? `/api/admin/event-editions?${query}` : "/api/admin/event-editions";
}

export async function fetchAdminEditionsCollection(
  params: EditionsListParams,
  signal?: AbortSignal,
): Promise<AdminEditionsCollectionResult> {
  const response = await fetch(buildAdminEditionsApiUrl(params), {
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
      const payload = (await response.json()) as EditionsApiError;
      if (typeof payload.error === "string" && payload.error.trim() !== "") {
        message = payload.error;
      }
    } catch {
      // Keep default message when error body is not JSON.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    editions?: AdminEditionsCollectionResult["editions"];
    total?: number;
    params?: EditionsListParams;
  };

  if (!payload.ok || !Array.isArray(payload.editions) || payload.params === undefined) {
    throw new Error(payload.error ?? "Failed to load events.");
  }

  return {
    editions: payload.editions,
    total: payload.total ?? payload.editions.length,
    params: payload.params,
  };
}
