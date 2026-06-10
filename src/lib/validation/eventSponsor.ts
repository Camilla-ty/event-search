const TIER_RANK_MIN = 1;
const TIER_RANK_MAX = 1000;
const TIER_LABEL_MAX_LENGTH = 80;

export type EventSponsorUpdatePatch = {
  tier_rank?: number;
  tier_label?: string | null;
};

/**
 * Validates a PATCH body for an `event_sponsors` link.
 *
 * v1 rules:
 * - `tier_rank` is required when present: integer between 1 and 1000.
 *   Clearing to null is intentionally not allowed (rank drives public
 *   ordering and anonymous visibility).
 * - `tier_label` may be cleared: null or blank string stores null.
 */
export function validateEventSponsorUpdateBody(
  body: Record<string, unknown>,
): { ok: true; patch: EventSponsorUpdatePatch } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const patch: EventSponsorUpdatePatch = {};

  if ("tier_rank" in body) {
    const raw = body.tier_rank;
    const rank =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim() !== ""
          ? Number(raw)
          : null;

    if (rank === null || !Number.isInteger(rank)) {
      errors.push("tier_rank must be an integer");
    } else if (rank < TIER_RANK_MIN || rank > TIER_RANK_MAX) {
      errors.push(
        `tier_rank must be between ${TIER_RANK_MIN} and ${TIER_RANK_MAX}`,
      );
    } else {
      patch.tier_rank = rank;
    }
  }

  if ("tier_label" in body) {
    const raw = body.tier_label;
    if (raw === null) {
      patch.tier_label = null;
    } else if (typeof raw === "string") {
      const label = raw.trim();
      if (label.length > TIER_LABEL_MAX_LENGTH) {
        errors.push(
          `tier_label must be at most ${TIER_LABEL_MAX_LENGTH} characters`,
        );
      } else {
        patch.tier_label = label === "" ? null : label;
      }
    } else {
      errors.push("tier_label must be a string or null");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, errors: ["No fields to update."] };
  }

  return { ok: true, patch };
}
