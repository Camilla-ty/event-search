import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { computeMoveOrderedLinkIds } from "@/src/features/exhibitors/lib/moveExhibitorOrder";
import type { ExhibitorMoveDirection } from "@/src/lib/validation/eventExhibitor";

function compareExhibitorsInTier(a: LiveExhibitorRow, b: LiveExhibitorRow): number {
  const aOrder = a.display_order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.display_order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.id.localeCompare(b.id);
}

export function sameExhibitorTierRank(a: number | null, b: number | null): boolean {
  return a === b;
}

export function exhibitorsInTier(
  exhibitors: readonly LiveExhibitorRow[],
  tierRank: number | null,
): LiveExhibitorRow[] {
  return exhibitors
    .filter((exhibitor) => sameExhibitorTierRank(exhibitor.tier_rank, tierRank))
    .sort(compareExhibitorsInTier);
}

export function applyExhibitorTierDisplayOrder(
  exhibitors: readonly LiveExhibitorRow[],
  tierRank: number | null,
  orderedLinkIds: readonly string[],
): LiveExhibitorRow[] {
  const orderById = new Map<string, number>(
    orderedLinkIds.map((linkId, index) => [linkId, index + 1]),
  );

  return exhibitors.map((exhibitor) => {
    if (!sameExhibitorTierRank(exhibitor.tier_rank, tierRank)) {
      return exhibitor;
    }
    const nextOrder = orderById.get(exhibitor.id);
    if (nextOrder === undefined) {
      return exhibitor;
    }
    return { ...exhibitor, display_order: nextOrder };
  });
}

export function computeMoveOrderedLinkIdsForExhibitors(
  exhibitors: readonly LiveExhibitorRow[],
  row: LiveExhibitorRow,
  direction: ExhibitorMoveDirection,
): readonly string[] | null {
  const tierExhibitors = exhibitorsInTier(exhibitors, row.tier_rank);
  return computeMoveOrderedLinkIds(
    tierExhibitors.map((exhibitor) => exhibitor.id),
    row.id,
    direction,
  );
}

/** Reorders link IDs after a drag-and-drop within one tier. */
export function reorderLinkIdsByDrag(
  orderedLinkIds: readonly string[],
  activeLinkId: string,
  overLinkId: string,
): readonly string[] | null {
  const oldIndex = orderedLinkIds.indexOf(activeLinkId);
  const newIndex = orderedLinkIds.indexOf(overLinkId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return null;
  }

  const next = [...orderedLinkIds];
  const [moved] = next.splice(oldIndex, 1);
  if (moved === undefined) {
    return null;
  }
  next.splice(newIndex, 0, moved);
  return next;
}

/**
 * Resolves a drag-and-drop within the exhibitor roster.
 * Cross-tier drops, disabled reorder, and missing IDs are no-ops.
 */
export function resolveExhibitorDragReorder(input: {
  exhibitors: readonly LiveExhibitorRow[];
  activeLinkId: string;
  overLinkId: string | null;
  reorderDisabled?: boolean;
}): { tierRank: number | null; orderedLinkIds: readonly string[] } | null {
  const { exhibitors, activeLinkId, overLinkId, reorderDisabled = false } = input;
  if (reorderDisabled || overLinkId === null || activeLinkId === overLinkId) {
    return null;
  }

  const active = exhibitors.find((row) => row.id === activeLinkId);
  const over = exhibitors.find((row) => row.id === overLinkId);
  if (!active || !over) {
    return null;
  }
  if (!sameExhibitorTierRank(active.tier_rank, over.tier_rank)) {
    return null;
  }

  const nextOrder = reorderLinkIdsByDrag(
    exhibitorsInTier(exhibitors, active.tier_rank).map((row) => row.id),
    activeLinkId,
    overLinkId,
  );
  if (nextOrder === null) {
    return null;
  }

  return { tierRank: active.tier_rank, orderedLinkIds: nextOrder };
}

export type DirtyExhibitorTierOrder = {
  tier_rank: number | null;
  ordered_link_ids: string[];
};

function tierRankSortKey(tierRank: number | null): string {
  return tierRank === null ? "__null__" : String(tierRank);
}

function compareTierRankKeys(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function distinctExhibitorTierRanks(
  exhibitors: readonly LiveExhibitorRow[],
): (number | null)[] {
  const byKey = new Map<string, number | null>();
  for (const exhibitor of exhibitors) {
    const key = tierRankSortKey(exhibitor.tier_rank);
    if (!byKey.has(key)) {
      byKey.set(key, exhibitor.tier_rank);
    }
  }
  return Array.from(byKey.values()).sort(compareTierRankKeys);
}

export function getOrderedExhibitorLinkIdsForTier(
  exhibitors: readonly LiveExhibitorRow[],
  tierRank: number | null,
): string[] {
  return exhibitorsInTier(exhibitors, tierRank).map((exhibitor) => exhibitor.id);
}

function orderedLinkIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

/** Tiers whose link order differs between saved and draft rosters. */
export function getDirtyExhibitorTierOrders(
  saved: readonly LiveExhibitorRow[],
  draft: readonly LiveExhibitorRow[],
): DirtyExhibitorTierOrder[] {
  const tierRanks = distinctExhibitorTierRanks([...saved, ...draft]);
  const dirty: DirtyExhibitorTierOrder[] = [];

  for (const tierRank of tierRanks) {
    const savedIds = getOrderedExhibitorLinkIdsForTier(saved, tierRank);
    const draftIds = getOrderedExhibitorLinkIdsForTier(draft, tierRank);
    if (!orderedLinkIdsEqual(savedIds, draftIds)) {
      dirty.push({ tier_rank: tierRank, ordered_link_ids: [...draftIds] });
    }
  }

  return dirty;
}

export function isExhibitorRosterOrderDirty(
  saved: readonly LiveExhibitorRow[],
  draft: readonly LiveExhibitorRow[],
): boolean {
  return getDirtyExhibitorTierOrders(saved, draft).length > 0;
}

/**
 * After a server refetch: keep local draft order when dirty so a failed save
 * remains recoverable; otherwise sync both sides to fresh rows.
 */
export function applyRefetchedExhibitorRoster(
  freshExhibitors: LiveExhibitorRow[],
  currentSaved: readonly LiveExhibitorRow[],
  currentDraft: readonly LiveExhibitorRow[],
): { savedRoster: LiveExhibitorRow[]; draftRoster: LiveExhibitorRow[] } {
  if (isExhibitorRosterOrderDirty(currentSaved, currentDraft)) {
    return { savedRoster: freshExhibitors, draftRoster: [...currentDraft] };
  }
  return { savedRoster: freshExhibitors, draftRoster: freshExhibitors };
}
