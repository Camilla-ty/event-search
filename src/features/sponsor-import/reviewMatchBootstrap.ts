import type { ApiErr, ApiOk } from "./client/types";

export type ReviewMatchBootstrapResult = {
  matchError: string | null;
  rowsLoaded: boolean;
  /** Server may still be writing match results; review actions must stay locked. */
  matchInProgress: boolean;
};

/**
 * Review-step bootstrap: attempt matching, then always load persisted rows.
 * Match failure/timeout must not block reading DB state. When matching did not
 * succeed, the batch phase decides whether results are still being written.
 */
export async function bootstrapReviewMatching(options: {
  runMatching: () => Promise<ApiOk<{ matched_count: number }> | ApiErr>;
  loadRows: () => Promise<boolean>;
  readProcessingPhase: () => Promise<string | null>;
}): Promise<ReviewMatchBootstrapResult> {
  let matchError: string | null = null;
  let matchInProgress = false;

  const matched = await options.runMatching();
  if (!matched.ok) {
    matchError = matched.error;
    try {
      matchInProgress = (await options.readProcessingPhase()) === "matching";
    } catch {
      // Unknown server state after a failed match: stay locked until the user checks again.
      matchInProgress = true;
    }
  }

  let rowsLoaded = false;
  try {
    rowsLoaded = await options.loadRows();
  } catch {
    rowsLoaded = false;
  }

  return { matchError, rowsLoaded, matchInProgress };
}
