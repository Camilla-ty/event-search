import type { EventRecord } from "@/src/features/events/components/explorer/types";
import {
  areEventExplorerRegionsEqual,
  editionMatchesEventExplorerRegions,
  normalizeEventExplorerRegions,
} from "@/src/features/events/lib/eventExplorerQuery";

export function areRegionSelectionsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return areEventExplorerRegionsEqual(left, right);
}

/**
 * True when draft regions are a strict subset of server regions — optimistic
 * narrowing can fully reflect draft filters on the current server snapshot.
 */
export function isRegionOptimisticDisplaySufficient(
  draftRegions: readonly string[],
  serverRegions: readonly string[],
): boolean {
  const draft = new Set(normalizeEventExplorerRegions({ regions: draftRegions }));
  const server = new Set(normalizeEventExplorerRegions({ regions: serverRegions }));

  if (draft.size === 0 || draft.size >= server.size) return false;

  for (const region of draft) {
    if (!server.has(region)) return false;
  }

  return true;
}

export function eventMatchesDraftRegionFilter(
  event: Pick<EventRecord, "cities">,
  draftRegions: readonly string[],
): boolean {
  return editionMatchesEventExplorerRegions(event, draftRegions);
}

export function applyOptimisticCountryDisplayFilter(
  events: readonly EventRecord[],
  options: {
    draftRegions: readonly string[];
    serverRegions: readonly string[];
    isFiltersApplying: boolean;
  },
): EventRecord[] {
  const { draftRegions, serverRegions, isFiltersApplying } = options;

  if (!isFiltersApplying) {
    return [...events];
  }

  if (areRegionSelectionsEqual(draftRegions, serverRegions)) {
    return [...events];
  }

  const normalizedDraftRegions = normalizeEventExplorerRegions({ regions: draftRegions });

  // Clearing regions cannot expand beyond the current server snapshot.
  if (normalizedDraftRegions.length === 0) {
    return [...events];
  }

  return events.filter((event) => eventMatchesDraftRegionFilter(event, normalizedDraftRegions));
}
