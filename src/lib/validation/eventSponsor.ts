const TIER_RANK_MIN = 1;
const TIER_RANK_MAX = 1000;
const TIER_LABEL_MAX_LENGTH = 80;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventSponsorUpdatePatch = {
  tier_rank?: number;
  tier_label?: string | null;
};

export type EventSponsorCreatePayload = {
  company_id: string;
  tier_rank: number;
  tier_label: string | null;
};

function parseTierRank(
  raw: unknown,
): { ok: true; rank: number } | { ok: false; error: string } {
  const rank =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : null;
  if (rank === null || !Number.isInteger(rank)) {
    return { ok: false, error: "tier_rank must be an integer" };
  }
  if (rank < TIER_RANK_MIN || rank > TIER_RANK_MAX) {
    return {
      ok: false,
      error: `tier_rank must be between ${TIER_RANK_MIN} and ${TIER_RANK_MAX}`,
    };
  }
  return { ok: true, rank };
}

function parseTierLabel(
  raw: unknown,
): { ok: true; label: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, label: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "tier_label must be a string or null" };
  }
  const label = raw.trim();
  if (label.length > TIER_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `tier_label must be at most ${TIER_LABEL_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, label: label === "" ? null : label };
}

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
    const rank = parseTierRank(body.tier_rank);
    if (rank.ok) {
      patch.tier_rank = rank.rank;
    } else {
      errors.push(rank.error);
    }
  }

  if ("tier_label" in body) {
    const label = parseTierLabel(body.tier_label);
    if (label.ok) {
      patch.tier_label = label.label;
    } else {
      errors.push(label.error);
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

export type SponsorMoveDirection = "up" | "down";

/** Validates a POST body for moving a sponsor within its tier. */
export function validateEventSponsorMoveBody(
  body: Record<string, unknown>,
): { ok: true; direction: SponsorMoveDirection } | { ok: false; errors: string[] } {
  const raw = body.direction;
  if (raw === "up" || raw === "down") {
    return { ok: true, direction: raw };
  }
  return { ok: false, errors: ['direction must be "up" or "down"'] };
}

/**
 * Validates a POST body that attaches a company to an edition.
 *
 * `company_id` and `tier_rank` are required; `tier_label` is optional
 * (null/blank stores null).
 */
export function validateEventSponsorCreateBody(
  body: Record<string, unknown>,
):
  | { ok: true; data: EventSponsorCreatePayload }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const companyIdRaw = body.company_id;
  const companyId =
    typeof companyIdRaw === "string" && UUID_REGEX.test(companyIdRaw.trim())
      ? companyIdRaw.trim()
      : null;
  if (companyId === null) {
    errors.push("company_id must be a valid UUID");
  }

  const rank = parseTierRank(body.tier_rank);
  if (!rank.ok) {
    errors.push(rank.error);
  }

  const label = parseTierLabel(body.tier_label);
  if (!label.ok) {
    errors.push(label.error);
  }

  if (errors.length > 0 || companyId === null || !rank.ok || !label.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      company_id: companyId,
      tier_rank: rank.rank,
      tier_label: label.label,
    },
  };
}
