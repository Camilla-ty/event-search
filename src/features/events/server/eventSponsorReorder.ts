import type { SponsorMoveDirection } from "@/src/lib/validation/eventSponsor";

export type TierReorderLinkIdsValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Ensures ordered IDs are a complete permutation of the tier's sibling IDs. */
export function validateTierReorderLinkIds(
  orderedLinkIds: readonly string[],
  siblingLinkIds: readonly string[],
  noun: string = "sponsor",
): TierReorderLinkIdsValidationResult {
  if (orderedLinkIds.length === 0) {
    return { ok: false, error: "ordered_link_ids must not be empty." };
  }

  if (orderedLinkIds.length !== siblingLinkIds.length) {
    return {
      ok: false,
      error: `ordered_link_ids must include every ${noun} in this tier.`,
    };
  }

  const siblingSet = new Set(siblingLinkIds);
  const seen = new Set<string>();

  for (const linkId of orderedLinkIds) {
    if (!siblingSet.has(linkId)) {
      return {
        ok: false,
        error: `ordered_link_ids contains a ${noun} link outside this tier.`,
      };
    }
    if (seen.has(linkId)) {
      return { ok: false, error: "ordered_link_ids must not contain duplicates." };
    }
    seen.add(linkId);
  }

  if (seen.size !== siblingSet.size) {
    return {
      ok: false,
      error: `ordered_link_ids must include every ${noun} in this tier.`,
    };
  }

  return { ok: true };
}

/** Returns the new sibling order after one ↑/↓ step, or null when at a tier boundary. */
export function computeMoveOrderedLinkIds(
  orderedSiblingIds: readonly string[],
  linkId: string,
  direction: SponsorMoveDirection,
): readonly string[] | null {
  const index = orderedSiblingIds.indexOf(linkId);
  if (index === -1) {
    return null;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= orderedSiblingIds.length) {
    return null;
  }

  const next = [...orderedSiblingIds];
  const current = next[index];
  const neighbor = next[targetIndex];
  if (current === undefined || neighbor === undefined) {
    return null;
  }

  next[index] = neighbor;
  next[targetIndex] = current;
  return next;
}
