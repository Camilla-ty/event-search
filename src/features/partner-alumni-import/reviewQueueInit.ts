import type { RowSummary } from "./types";

export type ReviewQueueInitResult =
  | { ok: true; ranMatching: boolean }
  | { ok: false; cancelled: true; ranMatching: boolean }
  | { ok: false; cancelled?: false; error: string; ranMatching: boolean };

/** True when every row is in a terminal review state with no pending match work. */
export function isReviewQueueReadyToImport(summary: RowSummary): boolean {
  return (
    summary.auto_ready === 0 &&
    summary.needs_review === 0 &&
    summary.pending_duplicate_count === 0 &&
    summary.blocking_validation_count === 0 &&
    summary.resolved > 0 &&
    summary.resolved + summary.excluded === summary.total
  );
}

/** Skip rematching when the batch has no rows left in matchable statuses. */
export function shouldRunMatchingOnReviewMount(summary: RowSummary): boolean {
  if (summary.total === 0) return false;
  if (summary.auto_ready > 0 || summary.needs_review > 0) return true;
  return summary.resolved + summary.excluded < summary.total;
}

export async function runReviewQueueInit(input: {
  summary: RowSummary;
  runMatching: () => Promise<{ ok: true } | { ok: false; error: string }>;
  loadRows: () => Promise<boolean>;
  isCancelled: () => boolean;
}): Promise<ReviewQueueInitResult> {
  const ranMatching = shouldRunMatchingOnReviewMount(input.summary);

  if (ranMatching) {
    const matched = await input.runMatching();
    if (input.isCancelled()) {
      return { ok: false, cancelled: true, ranMatching: true };
    }
    if (!matched.ok) {
      return { ok: false, error: matched.error, ranMatching: true };
    }
  }

  const loaded = await input.loadRows();
  if (input.isCancelled()) {
    return { ok: false, cancelled: true, ranMatching };
  }
  if (!loaded) {
    return {
      ok: false,
      error: "Could not load review rows.",
      ranMatching,
    };
  }

  return { ok: true, ranMatching };
}
