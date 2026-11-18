import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SponsorImportRowStatus } from "../types";
import { SponsorImportHttpError } from "./errors";
import type { MatchableRow, MatchResult } from "./matchRows";
import { isMatchingRunCurrent } from "./matchRunPolicy";
import {
  runBatchMatchingWithDeps,
  type RunBatchMatchingDeps,
} from "./sponsorImportAdmin";

function row(id: string, status: SponsorImportRowStatus): MatchableRow {
  return {
    id,
    status,
    normalized_domain: `${id}.example`,
    normalized_website: `https://${id}.example`,
    normalized_company_name: id,
    mapped_tier_rank: 1,
    has_blocking_validation: false,
  };
}

function autoReady(companyId: string): MatchResult {
  return {
    status: "auto_ready",
    match_method: "domain",
    match_confidence: "high",
    proposed_company_id: companyId,
    conflict_type: null,
    already_on_live_sponsor_id: null,
    already_on_live_tier_rank: null,
    intended_link_action: "create_new_link",
  };
}

type Hooks = {
  beforeMatch?: (row: MatchableRow) => Promise<void> | void;
  failUpdateFor?: string;
  failLog?: boolean;
  failClear?: boolean;
  beforeLog?: () => Promise<void>;
  afterLog?: () => Promise<void>;
  afterClear?: () => Promise<void>;
};

/** In-memory batch whose claim/update semantics mirror the Supabase queries. */
function createFakeBatch(initialRows: MatchableRow[]) {
  const state = {
    phase: null as string | null,
    logs: [] as number[],
    /** Ordered matching_run / column_mapping_saved / validation_run log types. */
    actions: [] as string[],
    rows: new Map(initialRows.map((r) => [r.id, { ...r, proposed_company_id: null as string | null }])),
    claims: 0,
    rowWrites: [] as string[],
  };
  const hooks: Hooks = {};

  const deps: RunBatchMatchingDeps = {
    hasCurrentMatchingRun: async () => isMatchingRunCurrent(state.actions.at(-1) ?? null),
    latestMatchingRunAffectedCount: async () => state.logs.at(-1) ?? 0,
    claimMatchingPhase: async () => {
      if (state.phase !== null) return false;
      state.phase = "matching";
      state.claims += 1;
      return true;
    },
    readProcessingPhase: async () => state.phase,
    loadMatchableRows: async () => [...state.rows.values()].map((r) => ({ ...r })),
    createMatcher: async () => async (target) => {
      await hooks.beforeMatch?.(target);
      return autoReady(`company-${target.id}`);
    },
    updateRowIfStillMatchable: async (rowId, result) => {
      if (hooks.failUpdateFor === rowId) throw new Error("row update failed");
      const current = state.rows.get(rowId);
      if (!current || (current.status !== "needs_review" && current.status !== "auto_ready")) {
        return false;
      }
      current.status = result.status;
      current.proposed_company_id = result.proposed_company_id;
      state.rowWrites.push(rowId);
      return true;
    },
    appendMatchingRunLog: async (affectedCount) => {
      await hooks.beforeLog?.();
      if (hooks.failLog) throw new Error("Failed to write action log: insert failed");
      state.logs.push(affectedCount);
      state.actions.push("matching_run");
      await hooks.afterLog?.();
    },
    clearMatchingPhase: async () => {
      if (hooks.failClear) throw new Error("clear failed");
      if (state.phase === "matching") state.phase = null;
      await hooks.afterClear?.();
    },
  };

  return { state, hooks, deps };
}

async function assertInProgress409(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SponsorImportHttpError);
    assert.equal(error.status, 409);
    assert.equal(error.message, "Matching is already in progress.");
    return true;
  });
}

describe("runBatchMatchingWithDeps — completion and idempotency", () => {
  it("matches eligible rows, logs matching_run, and releases the claim", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review"), row("b", "auto_ready")]);

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 2, skipped: false });
    assert.deepEqual(state.logs, [2]);
    assert.equal(state.phase, null);
  });

  it("skips without touching rows when a matching_run already exists", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review")]);
    state.actions.push("column_mapping_saved", "validation_run", "matching_run");
    state.logs.push(7);

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 7, skipped: true });
    assert.equal(state.claims, 0);
    assert.deepEqual(state.rowWrites, []);
  });

  for (const invalidating of ["column_mapping_saved", "validation_run"]) {
    it(`rematches when ${invalidating} was logged after the last matching_run`, async () => {
      const { state, deps } = createFakeBatch([row("a", "needs_review"), row("done", "resolved")]);
      state.actions.push("matching_run", invalidating);
      state.logs.push(7);

      const result = await runBatchMatchingWithDeps({}, deps);

      assert.deepEqual(result, { matched_count: 1, skipped: false });
      assert.equal(state.claims, 1);
      assert.deepEqual(state.rowWrites, ["a"]);
      assert.equal(state.rows.get("done")?.status, "resolved");
      assert.equal(state.actions.at(-1), "matching_run");
    });
  }

  it("force rematches unresolved rows but never resolved or excluded rows", async () => {
    const { state, deps } = createFakeBatch([
      row("open", "needs_review"),
      row("done", "resolved"),
      row("skip", "excluded"),
    ]);
    state.actions.push("matching_run");
    state.logs.push(1);

    const result = await runBatchMatchingWithDeps({ force: true }, deps);

    assert.deepEqual(result, { matched_count: 1, skipped: false });
    assert.deepEqual(state.rowWrites, ["open"]);
    assert.equal(state.rows.get("done")?.status, "resolved");
    assert.equal(state.rows.get("skip")?.status, "excluded");
  });
});

describe("runBatchMatchingWithDeps — reviewer decisions during matching (F1)", () => {
  it("does not overwrite a row resolved after the snapshot was read", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review"), row("b", "needs_review")]);
    hooks.beforeMatch = (target) => {
      if (target.id === "a") {
        const b = state.rows.get("b");
        if (b) b.status = "resolved";
      }
    };

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.equal(state.rows.get("b")?.status, "resolved");
    assert.equal(state.rows.get("b")?.proposed_company_id, null);
    assert.deepEqual(state.rowWrites, ["a"]);
    assert.equal(result.matched_count, 1);
    assert.deepEqual(state.logs, [1]);
  });

  it("does not overwrite a row excluded after the snapshot was read", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "auto_ready"), row("b", "auto_ready")]);
    hooks.beforeMatch = (target) => {
      if (target.id === "a") {
        const b = state.rows.get("b");
        if (b) b.status = "excluded";
      }
    };

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.equal(state.rows.get("b")?.status, "excluded");
    assert.deepEqual(state.rowWrites, ["a"]);
    assert.equal(result.matched_count, 1);
  });

  it("completes normally when every conditional update affects zero rows", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.beforeMatch = () => {
      const a = state.rows.get("a");
      if (a) a.status = "resolved";
    };

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 0, skipped: false });
    assert.deepEqual(state.logs, [0]);
    assert.equal(state.phase, null);
  });
});

describe("runBatchMatchingWithDeps — concurrent requests (F3)", () => {
  it("lets only one of two simultaneous requests claim and match", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    hooks.beforeMatch = () => gate;

    const first = runBatchMatchingWithDeps({}, deps);
    const second = runBatchMatchingWithDeps({}, deps);

    await assertInProgress409(second);
    releaseFirst();
    assert.deepEqual(await first, { matched_count: 1, skipped: false });
    assert.equal(state.claims, 1);
    assert.deepEqual(state.rowWrites, ["a"]);
    assert.deepEqual(state.logs, [1]);
  });

  it("rejects a second request that arrives before matching_run is logged", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.beforeLog = async () => {
      hooks.beforeLog = undefined;
      await assertInProgress409(runBatchMatchingWithDeps({}, deps));
    };

    await runBatchMatchingWithDeps({}, deps);

    assert.equal(state.claims, 1);
    assert.deepEqual(state.rowWrites, ["a"]);
  });

  it("treats a request after logging but before releasing the claim as complete", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    let concurrent: unknown;
    hooks.afterLog = async () => {
      hooks.afterLog = undefined;
      concurrent = await runBatchMatchingWithDeps({}, deps);
    };

    await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(concurrent, { matched_count: 1, skipped: true });
    assert.equal(state.claims, 1);
    assert.deepEqual(state.rowWrites, ["a"]);
  });

  it("never rematches once the claim is released after completion", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    let concurrent: unknown;
    hooks.afterClear = async () => {
      hooks.afterClear = undefined;
      concurrent = await runBatchMatchingWithDeps({}, deps);
    };

    await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(concurrent, { matched_count: 1, skipped: true });
    assert.equal(state.claims, 1);
    assert.deepEqual(state.logs, [1]);
  });
});

describe("runBatchMatchingWithDeps — failures release the claim without logging", () => {
  it("clears processing_phase and writes no matching_run when a row update fails", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review"), row("b", "needs_review")]);
    hooks.failUpdateFor = "b";

    await assert.rejects(runBatchMatchingWithDeps({}, deps), /row update failed/);

    assert.equal(state.phase, null);
    assert.deepEqual(state.logs, []);

    hooks.failUpdateFor = undefined;
    const retry = await runBatchMatchingWithDeps({}, deps);
    assert.equal(retry.skipped, false);
    assert.deepEqual(state.logs, [2]);
  });

  it("clears processing_phase and allows a rerun when the action-log write fails", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.failLog = true;

    await assert.rejects(runBatchMatchingWithDeps({}, deps), /Failed to write action log/);

    assert.equal(state.phase, null);
    assert.deepEqual(state.logs, []);

    hooks.failLog = false;
    const retry = await runBatchMatchingWithDeps({}, deps);
    assert.equal(retry.skipped, false);
    assert.equal(state.claims, 2);
  });

  it("surfaces the original error when releasing the claim also fails", async () => {
    const { hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.failUpdateFor = "a";
    hooks.failClear = true;

    await assert.rejects(runBatchMatchingWithDeps({}, deps), /row update failed/);
  });
});
