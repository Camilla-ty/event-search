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
