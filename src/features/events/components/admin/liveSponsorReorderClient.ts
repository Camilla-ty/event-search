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
