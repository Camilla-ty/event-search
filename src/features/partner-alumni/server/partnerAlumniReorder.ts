import type { PartnerAlumniMoveDirection } from "@/src/lib/validation/partnerAlumni";

export type MemberReorderValidationResult = { ok: true } | { ok: false; error: string };

/** Ensures ordered IDs are a complete permutation of the version's member IDs. */
export function validateVersionMemberReorderIds(
  orderedMemberIds: readonly string[],
  siblingMemberIds: readonly string[],
): MemberReorderValidationResult {
  if (orderedMemberIds.length === 0) {
    return { ok: false, error: "ordered_member_ids must not be empty." };
  }

  if (orderedMemberIds.length !== siblingMemberIds.length) {
    return {
      ok: false,
      error: "ordered_member_ids must include every version member.",
    };
  }

  const siblingSet = new Set(siblingMemberIds);
  const seen = new Set<string>();

  for (const memberId of orderedMemberIds) {
    if (!siblingSet.has(memberId)) {
      return {
        ok: false,
        error: "ordered_member_ids contains a member outside this roster.",
      };
    }
    if (seen.has(memberId)) {
      return { ok: false, error: "ordered_member_ids must not contain duplicates." };
    }
    seen.add(memberId);
  }

  if (seen.size !== siblingSet.size) {
    return {
      ok: false,
      error: "ordered_member_ids must include every version member.",
    };
  }

  return { ok: true };
}

/** @deprecated Use validateVersionMemberReorderIds */
export const validateDraftMemberReorderIds = validateVersionMemberReorderIds;

/** Returns the new roster order after one ↑/↓ step, or null when at a boundary. */
export function computeMoveOrderedMemberIds(
  orderedMemberIds: readonly string[],
  memberId: string,
  direction: PartnerAlumniMoveDirection,
): readonly string[] | null {
  const index = orderedMemberIds.indexOf(memberId);
  if (index === -1) {
    return null;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= orderedMemberIds.length) {
    return null;
  }

  const next = [...orderedMemberIds];
  const current = next[index];
  const neighbor = next[targetIndex];
  if (current === undefined || neighbor === undefined) {
    return null;
  }

  next[index] = neighbor;
  next[targetIndex] = current;
  return next;
}
