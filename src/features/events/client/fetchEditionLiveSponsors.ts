import type { LiveSponsorRow } from "@/src/features/events/components/admin/liveSponsorTypes";

export type EditionLiveSponsorsResponse = {
  ok: true;
  sponsors: LiveSponsorRow[];
  count: number;
};

type EditionLiveSponsorsError = {
  ok?: boolean;
  error?: string;
};

export async function fetchEditionLiveSponsors(
  editionId: string,
  signal?: AbortSignal,
): Promise<EditionLiveSponsorsResponse> {
  const response = await fetch(`/api/admin/event-editions/${editionId}/sponsors`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Failed to load live sponsors.";
    try {
      const payload = (await response.json()) as EditionLiveSponsorsError;
      if (typeof payload.error === "string" && payload.error.trim() !== "") {
        message = payload.error;
      }
    } catch {
      // Keep default message when error body is not JSON.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as EditionLiveSponsorsResponse | EditionLiveSponsorsError;
  if (!payload.ok || !Array.isArray((payload as EditionLiveSponsorsResponse).sponsors)) {
    const error =
      typeof (payload as EditionLiveSponsorsError).error === "string"
        ? (payload as EditionLiveSponsorsError).error
        : "Failed to load live sponsors.";
    throw new Error(error ?? "Failed to load live sponsors.");
  }

  const data = payload as EditionLiveSponsorsResponse;
  return {
    ok: true,
    sponsors: data.sponsors,
    count: typeof data.count === "number" ? data.count : data.sponsors.length,
  };
}
