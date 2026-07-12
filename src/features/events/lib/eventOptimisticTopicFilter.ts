import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  areEventExplorerTopicSlugsEqual,
  editionMatchesEventExplorerTopicSlugs,
  normalizeEventExplorerTopics,
} from "@/src/features/events/lib/eventExplorerQuery";

export function areTopicSlugSelectionsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return areEventExplorerTopicSlugsEqual(left, right);
}

/**
 * True when draft topics are a strict subset of server topics — optimistic
 * narrowing can fully reflect draft filters on the current server snapshot.
 */
export function isTopicOptimisticDisplaySufficient(
  draftTopics: readonly string[],
  serverTopics: readonly string[],
): boolean {
  const draft = new Set(normalizeEventExplorerTopics({ topics: draftTopics }));
  const server = new Set(normalizeEventExplorerTopics({ topics: serverTopics }));

  if (draft.size === 0 || draft.size >= server.size) return false;

  for (const slug of draft) {
    if (!server.has(slug)) return false;
  }

  return true;
}

export function eventMatchesDraftTopicFilter(
  event: Pick<EventRecord, "series_keywords">,
  draftTopics: readonly string[],
): boolean {
  return editionMatchesEventExplorerTopicSlugs(event, draftTopics);
}

export function applyOptimisticTopicDisplayFilter(
  events: readonly EventRecord[],
  options: {
    draftTopics: readonly string[];
    serverTopics: readonly string[];
    isFiltersApplying: boolean;
  },
): EventRecord[] {
  const { draftTopics, serverTopics, isFiltersApplying } = options;

  if (!isFiltersApplying) {
    return [...events];
  }

  if (areTopicSlugSelectionsEqual(draftTopics, serverTopics)) {
    return [...events];
  }

  const normalizedDraftTopics = normalizeEventExplorerTopics({ topics: draftTopics });

  // Clearing topics cannot expand beyond the current server snapshot.
  if (normalizedDraftTopics.length === 0) {
    return [...events];
  }

  return events.filter((event) => eventMatchesDraftTopicFilter(event, normalizedDraftTopics));
}
