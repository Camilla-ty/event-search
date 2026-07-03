export const MEANINGFUL_EDITION_FIELDS = [
  "name",
  "slug",
  "start_date",
  "end_date",
  "website_url",
  "city_id",
  "venue_id",
] as const;

export const RESEARCH_ONLY_EDITION_FIELDS = [
  "last_reviewed_at",
  "primary_source_url",
] as const;

const MEANINGFUL_EDITION_FIELD_SET = new Set<string>(MEANINGFUL_EDITION_FIELDS);

export type EditionLastReviewedSnapshot = {
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  website_url: string | null;
  city_id: string | null;
  venue_id: string | null;
};

export type EventSponsorTierSnapshot = {
  tier_rank: number | null;
  tier_label: string | null;
};

function normalizeWebsiteUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeTierLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function fieldValueChanged(existingValue: unknown, patchValue: unknown, field: string): boolean {
  if (field === "website_url") {
    return normalizeWebsiteUrl(existingValue) !== normalizeWebsiteUrl(patchValue);
  }
  if (field === "name" || field === "slug") {
    const left = typeof existingValue === "string" ? existingValue.trim() : "";
    const right = typeof patchValue === "string" ? patchValue.trim() : "";
    return left !== right;
  }
  return existingValue !== patchValue;
}

/** True when a meaningful edition field in `patch` differs from `existing`. */
export function hasMeaningfulEditionFieldChange(
  existing: EditionLastReviewedSnapshot,
  patch: Record<string, unknown>,
): boolean {
  for (const field of MEANINGFUL_EDITION_FIELDS) {
    if (!(field in patch)) continue;
    if (fieldValueChanged(existing[field], patch[field], field)) {
      return true;
    }
  }
  return false;
}

/**
 * True when an edition update should set `last_reviewed_at` to `now()`.
 * Manual-only research saves (last reviewed / primary source only) return false.
 */
export function shouldSetAutoReviewTimestamp(
  existing: EditionLastReviewedSnapshot,
  patch: Record<string, unknown>,
): boolean {
  const keys = Object.keys(patch);
  if (keys.length === 0) return false;

  const hasMeaningfulKey = keys.some((key) => MEANINGFUL_EDITION_FIELD_SET.has(key));
  if (!hasMeaningfulKey) return false;

  return hasMeaningfulEditionFieldChange(existing, patch);
}

/**
 * Applies auto-review policy to an edition update patch.
 * Meaningful changes set `last_reviewed_at` to `nowIso`; manual-only saves are unchanged.
 */
export function applyEditionUpdateLastReviewedPolicy(
  existing: EditionLastReviewedSnapshot,
  patch: Record<string, unknown>,
  nowIso: string,
): Record<string, unknown> {
  const next = { ...patch };
  if (shouldSetAutoReviewTimestamp(existing, patch)) {
    next.last_reviewed_at = nowIso;
  }
  return next;
}

/** Edition create always persists a NULL review timestamp (creation is not review). */
export function editionCreateLastReviewedAtValue(): null {
  return null;
}

/** True when a sponsor link PATCH changes tier rank or tier label. */
export function shouldAutoTouchSponsorUpdate(
  existing: EventSponsorTierSnapshot,
  patch: { tier_rank?: number; tier_label?: string | null },
): boolean {
  if (patch.tier_rank !== undefined && patch.tier_rank !== existing.tier_rank) {
    return true;
  }
  if (
    patch.tier_label !== undefined &&
    normalizeTierLabel(patch.tier_label) !== normalizeTierLabel(existing.tier_label)
  ) {
    return true;
  }
  return false;
}

export type PublishTouchResult = {
  new_count: number;
  tier_updated_count: number;
  unchanged_count: number;
  excluded_count: number;
};

/** True when sponsor import publish wrote or confirmed live sponsor rows. */
export function shouldAutoTouchAfterPublish(result: PublishTouchResult): boolean {
  return (
    result.new_count > 0 || result.tier_updated_count > 0 || result.unchanged_count > 0
  );
}
