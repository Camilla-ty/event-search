import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isReviewQueueReadyToImport,
  runReviewQueueInit,
  shouldRunMatchingOnReviewMount,
} from "./reviewQueueInit";
import type { RowSummary } from "./types";

function summary(overrides: Partial<RowSummary> = {}): RowSummary {
  return {
    total: 460,
    needs_review: 0,
    auto_ready: 0,
    resolved: 454,
    excluded: 6,
    blocking_validation_count: 0,
    pending_duplicate_count: 0,
    ...overrides,
  };
}

describe("shouldRunMatchingOnReviewMount", () => {
  it("skips when all rows are resolved or excluded", () => {
    assert.equal(shouldRunMatchingOnReviewMount(summary()), false);
  });

  it("runs when auto-ready rows remain", () => {
    assert.equal(shouldRunMatchingOnReviewMount(summary({ auto_ready: 12 })), true);
  });

  it("runs when needs-review rows remain", () => {
    assert.equal(shouldRunMatchingOnReviewMount(summary({ needs_review: 3, resolved: 451 })), true);
  });

  it("runs when rows are still unaccounted for", () => {
    assert.equal(
      shouldRunMatchingOnReviewMount(
        summary({ resolved: 400, excluded: 6, needs_review: 0, auto_ready: 0 }),
      ),
      true,
    );
  });
});

describe("isReviewQueueReadyToImport", () => {
  it("is true for a fully resolved batch with importable rows", () => {
    assert.equal(isReviewQueueReadyToImport(summary()), true);
  });

  it("is false while auto-ready rows remain", () => {
    assert.equal(isReviewQueueReadyToImport(summary({ auto_ready: 1, resolved: 453 })), false);
  });
});

describe("runReviewQueueInit", () => {
  it("skips matching and loads rows for a fully resolved batch", async () => {
    let matchingCalls = 0;
    let loadCalls = 0;

    const result = await runReviewQueueInit({
      summary: summary(),
      runMatching: async () => {
        matchingCalls += 1;
        return { ok: true };
      },
      loadRows: async () => {
        loadCalls += 1;
        return true;
      },
      isCancelled: () => false,
    });

    assert.deepEqual(result, { ok: true, ranMatching: false });
    assert.equal(matchingCalls, 0);
    assert.equal(loadCalls, 1);
  });

  it("runs matching before loading when matchable rows remain", async () => {
    const phases: string[] = [];

    const result = await runReviewQueueInit({
      summary: summary({ auto_ready: 5, resolved: 449 }),
      runMatching: async () => {
        phases.push("match");
        return { ok: true };
      },
      loadRows: async () => {
        phases.push("load");
        return true;
      },
      isCancelled: () => false,
    });

    assert.deepEqual(result, { ok: true, ranMatching: true });
    assert.deepEqual(phases, ["match", "load"]);
  });

  it("reports cancellation after matching without treating it as a hard error", async () => {
    let cancelled = false;

    const result = await runReviewQueueInit({
      summary: summary({ auto_ready: 2, resolved: 452 }),
      runMatching: async () => {
        cancelled = true;
        return { ok: true };
      },
      loadRows: async () => {
        throw new Error("load should not run");
      },
      isCancelled: () => cancelled,
    });

    assert.deepEqual(result, { ok: false, cancelled: true, ranMatching: true });
  });

  it("simulates superseded init: later run still completes after earlier run was cancelled", async () => {
    let resolveFirstMatch: (() => void) | undefined;
    const firstMatch = new Promise<{ ok: true }>((resolve) => {
      resolveFirstMatch = () => resolve({ ok: true });
    });

    let firstCancelled = false;
    let secondCompleted = false;

    const first = runReviewQueueInit({
      summary: summary({ auto_ready: 3, resolved: 451 }),
      runMatching: () => firstMatch,
      loadRows: async () => true,
      isCancelled: () => firstCancelled,
    });

    firstCancelled = true;

    const second = await runReviewQueueInit({
      summary: summary(),
      runMatching: async () => {
        throw new Error("second run should skip matching");
      },
      loadRows: async () => {
        secondCompleted = true;
        return true;
      },
      isCancelled: () => false,
    });

    resolveFirstMatch?.();
    const firstResult = await first;

    assert.deepEqual(firstResult, { ok: false, cancelled: true, ranMatching: true });
    assert.deepEqual(second, { ok: true, ranMatching: false });
    assert.equal(secondCompleted, true);
  });
});
