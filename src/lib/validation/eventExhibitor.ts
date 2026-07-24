const TIER_RANK_MIN = 1;
const TIER_RANK_MAX = 1000;
const TIER_LABEL_MAX_LENGTH = 80;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventExhibitorUpdatePatch = {
  tier_rank?: number;
  tier_label?: string | null;
};

export type EventExhibitorCreatePayload = {
  company_id: string;
  tier_rank: number;
  tier_label: string | null;
};

export type EventExhibitorTierReorderPayload = {
  tier_rank: number | null;
  ordered_link_ids: string[];
};

export type ExhibitorMoveDirection = "up" | "down";

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

function parseTierRankOrNull(
  raw: unknown,
): { ok: true; rank: number | null } | { ok: false; error: string } {
  if (raw === null) {
    return { ok: true, rank: null };
  }
  const parsed = parseTierRank(raw);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, rank: parsed.rank };
}

function parseOrderedLinkIds(
  raw: unknown,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "ordered_link_ids must be an array." };
  }
  if (raw.length === 0) {
    return { ok: false, error: "ordered_link_ids must not be empty." };
  }
  if (raw.length > TIER_RANK_MAX) {
    return {
      ok: false,
      error: `ordered_link_ids must contain at most ${TIER_RANK_MAX} items.`,
    };
  }

  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !UUID_REGEX.test(item.trim())) {
      return { ok: false, error: "ordered_link_ids must contain valid UUIDs." };
    }
    ids.push(item.trim());
  }

  return { ok: true, ids };
}

/**
 * Validates a PATCH body for an `event_exhibitors` link.
 * Same rules as sponsors: rank 1–1000 when present (not clearable to null);
 * label optional / clearable.
 */
export function validateEventExhibitorUpdateBody(
  body: Record<string, unknown>,
): { ok: true; patch: EventExhibitorUpdatePatch } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const patch: EventExhibitorUpdatePatch = {};

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

/** Validates a POST body for bulk reorder within one exhibitor tier. */
export function validateEventExhibitorReorderBody(
  body: Record<string, unknown>,
):
  | { ok: true; data: EventExhibitorTierReorderPayload }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!("tier_rank" in body)) {
    errors.push("tier_rank is required.");
  }

  let tierRank: number | null | undefined;
  if ("tier_rank" in body) {
    const parsedRank = parseTierRankOrNull(body.tier_rank);
    if (parsedRank.ok) {
      tierRank = parsedRank.rank;
    } else {
      errors.push(parsedRank.error);
    }
  }

  let orderedLinkIds: string[] | undefined;
  if (!("ordered_link_ids" in body)) {
    errors.push("ordered_link_ids is required.");
  } else {
    const parsedIds = parseOrderedLinkIds(body.ordered_link_ids);
    if (parsedIds.ok) {
      orderedLinkIds = parsedIds.ids;
    } else {
      errors.push(parsedIds.error);
    }
  }

  if (errors.length > 0 || tierRank === undefined || orderedLinkIds === undefined) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      tier_rank: tierRank,
      ordered_link_ids: orderedLinkIds,
    },
  };
}

/**
 * Validates a POST body that attaches a company as an exhibitor.
 * `company_id` and `tier_rank` are required; `tier_label` is optional.
 */
export function validateEventExhibitorCreateBody(
  body: Record<string, unknown>,
):
  | { ok: true; data: EventExhibitorCreatePayload }
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
