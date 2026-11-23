/**
 * Pure policy helpers for Sponsor Import matching runs.
 * Keep side-effect-free so claim/skip decisions stay unit-testable.
 */

/** Skip a new matching pass when a current matching_run already exists, unless forced. */
export function shouldSkipMatchingBecauseAlreadyComplete(
  force: boolean,
  hasCurrentMatchingRun: boolean,
): boolean {
  return !force && hasCurrentMatchingRun;
}

/** Logged actions that rewrite import rows, so any earlier matching_run no longer reflects them. */
export const MATCHING_INVALIDATING_ACTION_TYPES = ["column_mapping_saved", "validation_run"] as const;

/**
 * `latestActionType` is the newest log among matching_run and the invalidating types.
 * A matching_run is current only if nothing invalidating was logged after it.
 */
export function isMatchingRunCurrent(latestActionType: string | null): boolean {
  return latestActionType === "matching_run";
}

/**
 * A matching claim whose token (`updated_at`) has not been renewed for this long is
 * treated as abandoned. Twice the match route's `maxDuration` (300s), and far longer
 * than the heartbeat interval, so a live run always renews well before this.
 */
export const STALE_MATCHING_CLAIM_MS = 10 * 60 * 1000;

/** Renew the claim token after this many processed rows or this much time, whichever comes first. */
export const MATCHING_HEARTBEAT_ROW_INTERVAL = 25;
export const MATCHING_HEARTBEAT_INTERVAL_MS = 30 * 1000;

export function isMatchingHeartbeatDue(
  rowsSinceHeartbeat: number,
  msSinceHeartbeat: number,
): boolean {
  return (
    rowsSinceHeartbeat >= MATCHING_HEARTBEAT_ROW_INTERVAL ||
    msSinceHeartbeat >= MATCHING_HEARTBEAT_INTERVAL_MS
  );
}

/**
 * Batch timestamps are `timestamp without time zone` holding UTC, and come back without
 * a zone suffix; `new Date()` would read those as local time. Returns NaN if unparseable.
 */
export function parseUtcTimestampMs(value: string): number {
  const isoLike = value.trim().replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(isoLike);
  return Date.parse(hasZone ? isoLike : `${isoLike}Z`);
}

/** Unknown or unparseable timestamps are never stale, so a live claim is never taken over by mistake. */
export function isStaleMatchingClaim(
  claim: { processing_phase: string | null; updated_at: string | null },
  nowMs: number,
): boolean {
  if (claim.processing_phase !== "matching" || !claim.updated_at) return false;
  const renewedAtMs = parseUtcTimestampMs(claim.updated_at);
  if (Number.isNaN(renewedAtMs)) return false;
  return nowMs - renewedAtMs >= STALE_MATCHING_CLAIM_MS;
}

export type MatchClaimFailureReason = "in_progress" | "could_not_start";

/**
 * After a failed atomic claim (`processing_phase IS NULL` update matched no row),
 * decide whether another matcher is running or the claim lost a race.
 */
export function resolveMatchClaimFailure(processingPhase: string | null): MatchClaimFailureReason {
  if (processingPhase === "matching") {
    return "in_progress";
  }
  return "could_not_start";
}
