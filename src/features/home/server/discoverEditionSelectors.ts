import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { compareRecentlyReviewedOrder } from "@/src/features/events/lib/eventExplorerOrdering";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";

export const DISCOVER_MODULE_LIMIT = 6;

export type DiscoverEditionCandidate = PublicEditionSummary & {
  last_reviewed_at: string | null;
};

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function readIsoDate(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed === "") return "";
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : "";
}

export function readEditionLastReviewedAt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function toReviewOrderable(edition: DiscoverEditionCandidate): EventRecord {
  return {
    id: edition.id,
    name: edition.name,
    series_id: null,
    last_reviewed_at: edition.last_reviewed_at,
  };
}

export function isUpcomingEdition(
  edition: Pick<PublicEditionSummary, "start_date" | "end_date">,
  today: string,
): boolean {
  const startDate = readIsoDate(edition.start_date);
  const endDate = readIsoDate(edition.end_date);

  if (startDate === "" && endDate === "") {
    return false;
  }

  if (startDate !== "" && startDate >= today) {
    return true;
  }

  if (
    startDate !== "" &&
    endDate !== "" &&
    startDate <= today &&
    endDate >= today
  ) {
    return true;
  }

  return false;
}

export function selectUpcomingEditions(
  editions: DiscoverEditionCandidate[],
  options?: { today?: string; limit?: number },
): PublicEditionSummary[] {
  const today = options?.today ?? new Date().toISOString().slice(0, 10);
  const limit = options?.limit ?? DISCOVER_MODULE_LIMIT;

  return editions
    .filter((edition) => isUpcomingEdition(edition, today))
    .sort((a, b) => {
      const startA = readIsoDate(a.start_date);
      const startB = readIsoDate(b.start_date);
      if (startA !== "" && startB !== "") {
        const byStart = compareStringsAsc(startA, startB);
        if (byStart !== 0) return byStart;
      } else if (startA !== "") {
        return -1;
      } else if (startB !== "") {
        return 1;
      }

      return compareStringsAsc(a.name, b.name);
    })
    .slice(0, limit)
    .map(stripLastReviewedAt);
}

export function selectRecentlyReviewedEditions(
  editions: DiscoverEditionCandidate[],
  options?: { limit?: number },
): PublicEditionSummary[] {
  const limit = options?.limit ?? DISCOVER_MODULE_LIMIT;

  return editions
    .slice()
    .sort((a, b) =>
      compareRecentlyReviewedOrder(toReviewOrderable(a), toReviewOrderable(b)),
    )
    .slice(0, limit)
    .map(stripLastReviewedAt);
}

function stripLastReviewedAt(edition: DiscoverEditionCandidate): PublicEditionSummary {
  return {
    id: edition.id,
    slug: edition.slug,
    name: edition.name,
    year: edition.year,
    start_date: edition.start_date,
    end_date: edition.end_date,
    locationLabel: edition.locationLabel,
    event_series: edition.event_series,
  };
}
