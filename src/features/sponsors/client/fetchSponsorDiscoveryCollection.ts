import { buildSponsorDiscoveryApiUrl } from "@/src/features/sponsors/client/sponsorDiscoveryApiUrl";
import type {
  SponsorDiscoveryParams,
  SponsorDiscoveryResult,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

type DiscoveryApiError = {
  ok?: boolean;
  error?: string;
};

export async function fetchSponsorDiscoveryCollection(
  params: SponsorDiscoveryParams,
  signal?: AbortSignal,
): Promise<SponsorDiscoveryResult> {
  const response = await fetch(buildSponsorDiscoveryApiUrl(params), {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Failed to load sponsors.";
    try {
      const payload = (await response.json()) as DiscoveryApiError;
      if (typeof payload.error === "string" && payload.error.trim() !== "") {
        message = payload.error;
      }
    } catch {
      // Keep default message when error body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as SponsorDiscoveryResult;
}
