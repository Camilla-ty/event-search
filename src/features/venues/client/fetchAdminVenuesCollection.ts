import type { AdminVenuesCollectionResult } from "@/src/features/venues/server/adminVenuesCollection";
import { buildVenuesListSearchParams } from "@/src/features/venues/server/venuesListParams";
import type { VenuesListParams } from "@/src/features/venues/server/venuesListParams";

type VenuesApiError = {
  ok?: boolean;
  error?: string;
};

export function buildAdminVenuesApiUrl(params: VenuesListParams): string {
  const query = buildVenuesListSearchParams(params).toString();
  return query !== "" ? `/api/admin/venues?${query}` : "/api/admin/venues";
}

export async function fetchAdminVenuesCollection(
  params: VenuesListParams,
  signal?: AbortSignal,
): Promise<AdminVenuesCollectionResult> {
  const response = await fetch(buildAdminVenuesApiUrl(params), {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Failed to load venues.";
    try {
      const payload = (await response.json()) as VenuesApiError;
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
    venues?: AdminVenuesCollectionResult["venues"];
    total?: number;
    params?: VenuesListParams;
  };

  if (!payload.ok || !Array.isArray(payload.venues) || payload.params === undefined) {
    throw new Error(payload.error ?? "Failed to load venues.");
  }

  return {
    venues: payload.venues,
    total: payload.total ?? payload.venues.length,
    params: payload.params,
  };
}
