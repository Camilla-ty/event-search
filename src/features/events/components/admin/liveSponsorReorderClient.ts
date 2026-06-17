import type { LiveSponsorRow, SponsorMoveDirection } from "./liveSponsorTypes";

function compareSponsorsInTier(a: LiveSponsorRow, b: LiveSponsorRow): number {
  const aOrder = a.display_order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.display_order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.id.localeCompare(b.id);
}

export function sameTierRank(a: number | null, b: number | null): boolean {
  return a === b;
}

export function sponsorsInTier(
  sponsors: readonly LiveSponsorRow[],
  tierRank: number | null,
): LiveSponsorRow[] {
  return sponsors
    .filter((sponsor) => sameTierRank(sponsor.tier_rank, tierRank))
    .sort(compareSponsorsInTier);
}

export function applyTierDisplayOrder(
  sponsors: readonly LiveSponsorRow[],
  tierRank: number | null,
  orderedLinkIds: readonly string[],
): LiveSponsorRow[] {
  const orderById = new Map<string, number>(
    orderedLinkIds.map((linkId, index) => [linkId, index + 1]),
  );

  return sponsors.map((sponsor) => {
    if (!sameTierRank(sponsor.tier_rank, tierRank)) {
      return sponsor;
    }
    const nextOrder = orderById.get(sponsor.id);
    if (nextOrder === undefined) {
      return sponsor;
    }
    return { ...sponsor, display_order: nextOrder };
  });
}

export function computeMoveOrderedLinkIdsForSponsors(
  sponsors: readonly LiveSponsorRow[],
  row: LiveSponsorRow,
  direction: SponsorMoveDirection,
): readonly string[] | null {
  const tierSponsors = sponsorsInTier(sponsors, row.tier_rank);
  const orderedIds = tierSponsors.map((sponsor) => sponsor.id);
  const index = orderedIds.indexOf(row.id);
  if (index === -1) {
    return null;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= orderedIds.length) {
    return null;
  }

  const next = [...orderedIds];
  const current = next[index];
  const neighbor = next[targetIndex];
  if (current === undefined || neighbor === undefined) {
    return null;
  }

  next[index] = neighbor;
  next[targetIndex] = current;
  return next;
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

export type DirtyTierOrder = {
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

export function distinctTierRanks(sponsors: readonly LiveSponsorRow[]): (number | null)[] {
  const byKey = new Map<string, number | null>();
  for (const sponsor of sponsors) {
    const key = tierRankSortKey(sponsor.tier_rank);
    if (!byKey.has(key)) {
      byKey.set(key, sponsor.tier_rank);
    }
  }
  return Array.from(byKey.values()).sort(compareTierRankKeys);
}

export function getOrderedLinkIdsForTier(
  sponsors: readonly LiveSponsorRow[],
  tierRank: number | null,
): string[] {
  return sponsorsInTier(sponsors, tierRank).map((sponsor) => sponsor.id);
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
export function getDirtyTierOrders(
  saved: readonly LiveSponsorRow[],
  draft: readonly LiveSponsorRow[],
): DirtyTierOrder[] {
  const tierRanks = distinctTierRanks([...saved, ...draft]);
  const dirty: DirtyTierOrder[] = [];

  for (const tierRank of tierRanks) {
    const savedIds = getOrderedLinkIdsForTier(saved, tierRank);
    const draftIds = getOrderedLinkIdsForTier(draft, tierRank);
    if (!orderedLinkIdsEqual(savedIds, draftIds)) {
      dirty.push({ tier_rank: tierRank, ordered_link_ids: [...draftIds] });
    }
  }

  return dirty;
}

export function isRosterOrderDirty(
  saved: readonly LiveSponsorRow[],
  draft: readonly LiveSponsorRow[],
): boolean {
  return getDirtyTierOrders(saved, draft).length > 0;
}
