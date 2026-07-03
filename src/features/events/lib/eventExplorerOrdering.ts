import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  eventExplorerDomainMatchesQuery,
  normalizeEventExplorerWebsiteHost,
  readEventExplorerWebsiteHosts,
} from "@/src/features/events/lib/eventExplorerDomain";
import { normalizeExplorerText } from "@/src/features/events/lib/eventExplorerQuery";
import {
  readEventDateRange,
  readEventIsoDate,
} from "@/src/features/events/lib/readEventIsoDate";

export const RECENTLY_ENDED_DAYS = 180;

export type EventExplorerSortMode = "recommended" | "reviewed" | "date" | "name";

export const DEFAULT_EVENT_EXPLORER_SORT_MODE: EventExplorerSortMode = "recommended";

export type EventTemporalBucket =
  | "recently_ended"
  | "ongoing"
  | "upcoming"
  | "older_ended"
  | "dateless";

export type EventExplorerOrderable = EventRecord;

const TEMPORAL_BUCKET_PRIORITY: Record<EventTemporalBucket, number> = {
  recently_ended: 0,
  ongoing: 1,
  upcoming: 2,
  older_ended: 3,
  dateless: 4,
};

function readNormalizedEventName(event: EventExplorerOrderable): string {
  return normalizeExplorerText(event.name);
}

function readNormalizedSeriesName(event: EventExplorerOrderable): string {
  return normalizeExplorerText(event.event_series?.name);
}

function subtractDaysIso(isoDate: string, days: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function classifyEventTemporalBucket(
  event: Pick<EventExplorerOrderable, "start_date" | "end_date">,
  today: string,
): EventTemporalBucket {
  const range = readEventDateRange(event);
  if (range === null) return "dateless";

  if (range.start <= today && range.end >= today) {
    return "ongoing";
  }

  if (range.start > today) {
    return "upcoming";
  }

  if (range.end < today) {
    const recentCutoff = subtractDaysIso(today, RECENTLY_ENDED_DAYS);
    return range.end >= recentCutoff ? "recently_ended" : "older_ended";
  }

  return "dateless";
}

/**
 * Lower tier = better relevance match.
 * Returns 99 when nothing matches (should not occur post-filter).
 */
export function scoreEventSearchRelevanceTier(
  event: EventExplorerOrderable,
  query: string,
): number {
  const textQuery = normalizeExplorerText(query);
  if (textQuery === "") return 99;

  const eventName = readNormalizedEventName(event);
  const seriesName = readNormalizedSeriesName(event);
  const domainQuery = normalizeEventExplorerWebsiteHost(query);
  const hosts = readEventExplorerWebsiteHosts(event);

  if (eventName === textQuery) return 1;
  if (seriesName === textQuery) return 2;

  if (
    domainQuery !== "" &&
    (hosts.edition === domainQuery || hosts.series === domainQuery)
  ) {
    return 3;
  }

  if (
    eventName.startsWith(textQuery) ||
    seriesName.startsWith(textQuery) ||
    eventExplorerDomainMatchesQuery(event, query, "prefix")
  ) {
    return 4;
  }

  if (
    eventName.includes(textQuery) ||
    seriesName.includes(textQuery) ||
    eventExplorerDomainMatchesQuery(event, query, "includes")
  ) {
    return 5;
  }

  return 99;
}

function compareIsoDesc(a: string, b: string): number {
  if (a === "" && b === "") return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  return b.localeCompare(a);
}

function compareIsoAsc(a: string, b: string): number {
  if (a === "" && b === "") return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  return a.localeCompare(b);
}

function hasLastReviewed(event: EventExplorerOrderable): boolean {
  const value = event.last_reviewed_at;
  return typeof value === "string" && value.trim() !== "";
}

function compareReviewedPriority(
  a: EventExplorerOrderable,
  b: EventExplorerOrderable,
): number {
  const reviewedA = hasLastReviewed(a) ? 0 : 1;
  const reviewedB = hasLastReviewed(b) ? 0 : 1;
  return reviewedA - reviewedB;
}

function compareSponsorCountDesc(
  a: EventExplorerOrderable,
  b: EventExplorerOrderable,
): number {
  return (b.sponsor_count ?? 0) - (a.sponsor_count ?? 0);
}

function compareWithinTemporalBucket(
  a: EventExplorerOrderable,
  b: EventExplorerOrderable,
  bucket: EventTemporalBucket,
): number {
  const rangeA = readEventDateRange(a);
  const rangeB = readEventDateRange(b);

  switch (bucket) {
    case "recently_ended":
    case "older_ended": {
      const endA = rangeA?.end ?? "";
      const endB = rangeB?.end ?? "";
      const byEnd = compareIsoDesc(endA, endB);
      if (byEnd !== 0) return byEnd;
      const startA = rangeA?.start ?? "";
      const startB = rangeB?.start ?? "";
      return compareIsoDesc(startA, startB);
    }
    case "ongoing": {
      const endA = rangeA?.end ?? "";
      const endB = rangeB?.end ?? "";
      const byEnd = compareIsoAsc(endA, endB);
      if (byEnd !== 0) return byEnd;
      const startA = rangeA?.start ?? "";
      const startB = rangeB?.start ?? "";
      return compareIsoAsc(startA, startB);
    }
    case "upcoming": {
      const startA = rangeA?.start ?? "";
      const startB = rangeB?.start ?? "";
      return compareIsoAsc(startA, startB);
    }
    case "dateless":
    default:
      return 0;
  }
}

export function compareEventBrowseRecommendedOrder(
  a: EventExplorerOrderable,
  b: EventExplorerOrderable,
  today: string,
): number {
  const reviewedDiff = compareReviewedPriority(a, b);
  if (reviewedDiff !== 0) return reviewedDiff;

  const bucketA = classifyEventTemporalBucket(a, today);
  const bucketB = classifyEventTemporalBucket(b, today);
  const bucketDiff = TEMPORAL_BUCKET_PRIORITY[bucketA] - TEMPORAL_BUCKET_PRIORITY[bucketB];
  if (bucketDiff !== 0) return bucketDiff;

  const sponsorDiff = compareSponsorCountDesc(a, b);
  if (sponsorDiff !== 0) return sponsorDiff;

  const withinBucket = compareWithinTemporalBucket(a, b, bucketA);
  if (withinBucket !== 0) return withinBucket;

  const byName = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;

  return a.id.localeCompare(b.id);
}

export function compareEventSearchOrder(
  a: EventExplorerOrderable,
  b: EventExplorerOrderable,
  query: string,
  today: string,
): number {
  const tierDiff = scoreEventSearchRelevanceTier(a, query) - scoreEventSearchRelevanceTier(b, query);
  if (tierDiff !== 0) return tierDiff;

  const bucketA = classifyEventTemporalBucket(a, today);
  const bucketB = classifyEventTemporalBucket(b, today);
  const bucketDiff = TEMPORAL_BUCKET_PRIORITY[bucketA] - TEMPORAL_BUCKET_PRIORITY[bucketB];
  if (bucketDiff !== 0) return bucketDiff;

  const withinBucket = compareWithinTemporalBucket(a, b, bucketA);
  if (withinBucket !== 0) return withinBucket;

  const byName = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;

  return a.id.localeCompare(b.id);
}

function compareChronologicalOrder(a: EventExplorerOrderable, b: EventExplorerOrderable): number {
  const startA = readEventIsoDate(a.start_date);
  const startB = readEventIsoDate(b.start_date);
  const byStart = compareIsoAsc(startA, startB);
  if (byStart !== 0) return byStart;

  const byName = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;

  return a.id.localeCompare(b.id);
}

function compareNameOrder(a: EventExplorerOrderable, b: EventExplorerOrderable): number {
  const byName = (a.name ?? "").localeCompare(b.name ?? "", undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

function readLastReviewedAt(event: EventExplorerOrderable): string {
  const value = event.last_reviewed_at;
  if (typeof value !== "string") return "";
  return value.trim();
}

export function compareRecentlyReviewedOrder(
  a: EventExplorerOrderable,
  b: EventExplorerOrderable,
): number {
  const reviewedA = readLastReviewedAt(a);
  const reviewedB = readLastReviewedAt(b);
  const byReviewedAt = compareIsoDesc(reviewedA, reviewedB);
  if (byReviewedAt !== 0) return byReviewedAt;

  return compareNameOrder(a, b);
}

export function sortEventExplorerResults<T extends EventRecord>(
  events: readonly T[],
  options: {
    query: string;
    sortMode: EventExplorerSortMode;
    today?: string;
  },
): T[] {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const query = options.query.trim();

  if (options.sortMode === "name") {
    return [...events].sort(compareNameOrder);
  }

  if (options.sortMode === "date") {
    return [...events].sort(compareChronologicalOrder);
  }

  if (options.sortMode === "reviewed") {
    return [...events].sort(compareRecentlyReviewedOrder);
  }

  if (query === "") {
    return [...events].sort((a, b) => compareEventBrowseRecommendedOrder(a, b, today));
  }

  return [...events].sort((a, b) => compareEventSearchOrder(a, b, query, today));
}
