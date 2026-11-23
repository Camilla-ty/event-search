import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SponsorImportRowStatus } from "../types";
import { SponsorImportHttpError } from "./errors";
import type { MatchableRow, MatchResult } from "./matchRows";
import { isMatchingRunCurrent, STALE_MATCHING_CLAIM_MS } from "./matchRunPolicy";
import {
  COLUMN_MAPPING_IN_PROGRESS_MESSAGE,
  MATCHING_CLAIM_LOST_MESSAGE,
  runBatchMatchingWithDeps,
  VALIDATION_IN_PROGRESS_MESSAGE,
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
  failRelease?: boolean;
  beforeLog?: () => Promise<void>;
  afterLog?: () => Promise<void>;
  afterRelease?: () => Promise<void>;
};

type FakeLog = { count: number; claimToken: string | null; recoveredStaleClaim: boolean };

const START_MS = Date.parse("2026-11-18T09:00:00.000Z");

/** `timestamp without time zone` text as PostgREST returns it (UTC, no zone suffix). */
function dbTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("Z", "");
}

/**
 * In-memory batch whose claim semantics mirror the Supabase queries: `updatedAt` is the
 * claim token, and renew/release only succeed while the caller's token still matches.
 */
function createFakeBatch(initialRows: MatchableRow[]) {
  const state = {
    nowMs: START_MS,
    phase: null as string | null,
    updatedAt: dbTimestamp(START_MS - 60 * 60 * 1000),
    logs: [] as FakeLog[],
    /** Ordered matching_run / column_mapping_saved / validation_run log types. */
    actions: [] as string[],
    rows: new Map(initialRows.map((r) => [r.id, { ...r, proposed_company_id: null as string | null }])),
    claims: 0,
    renewals: 0,
    rowWrites: [] as string[],
  };
  const hooks: Hooks = {};

  const issueToken = () => {
    state.nowMs += 1;
    return new Date(state.nowMs).toISOString();
  };

  const deps: RunBatchMatchingDeps = {
    readMatchingClaim: async () => ({ processing_phase: state.phase, updated_at: state.updatedAt }),
    hasCurrentMatchingRun: async () => isMatchingRunCurrent(state.actions.at(-1) ?? null),
    latestMatchingRunAffectedCount: async () => state.logs.at(-1)?.count ?? 0,
    latestMatchingRunClaimToken: async () => state.logs.at(-1)?.claimToken ?? null,
    claimMatchingPhase: async () => {
      if (state.phase !== null) return null;
      state.phase = "matching";
      state.updatedAt = issueToken();
      state.claims += 1;
      return state.updatedAt;
    },
    renewMatchingClaim: async (token) => {
      if (state.phase !== "matching" || state.updatedAt !== token) return null;
      state.updatedAt = issueToken();
      state.renewals += 1;
      return state.updatedAt;
    },
    releaseMatchingClaim: async (token) => {
      if (hooks.failRelease) throw new Error("release failed");
      if (state.phase !== "matching" || state.updatedAt !== token) return false;
      state.phase = null;
      state.updatedAt = issueToken();
      await hooks.afterRelease?.();
      return true;
    },
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
    appendMatchingRunLog: async ({ affectedCount, claimToken, recoveredStaleClaim }) => {
      await hooks.beforeLog?.();
      if (hooks.failLog) throw new Error("Failed to write action log: insert failed");
      state.logs.push({ count: affectedCount, claimToken, recoveredStaleClaim });
      state.actions.push("matching_run");
      await hooks.afterLog?.();
    },
    now: () => state.nowMs,
  };

  return { state, hooks, deps };
}

/** A matching_run written by an earlier, fully released run. */
function seedFinishedRun(state: ReturnType<typeof createFakeBatch>["state"], count: number) {
  state.logs.push({ count, claimToken: "2026-11-18T07:00:00.000Z", recoveredStaleClaim: false });
  state.actions.push("matching_run");
}

/** Leave the batch as a killed matcher would: phase `matching`, token last renewed `ageMs` ago. */
function abandonClaim(state: ReturnType<typeof createFakeBatch>["state"], ageMs: number) {
  state.phase = "matching";
  state.updatedAt = dbTimestamp(state.nowMs - ageMs);
}

async function assertInProgress409(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
    assert.equal(error.status, 409);
    assert.equal(error.message, "Matching is already in progress.");
    return true;
  });
}

describe("runBatchMatchingWithDeps — completion and idempotency", () => {
  it("matches eligible rows, logs matching_run with its claim token, and releases the claim", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review"), row("b", "auto_ready")]);

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 2, skipped: false });
    assert.equal(state.logs.length, 1);
    assert.equal(state.logs[0]?.count, 2);
    assert.equal(state.logs[0]?.recoveredStaleClaim, false);
    assert.equal(typeof state.logs[0]?.claimToken, "string", "matching_run must record its claim token");
    assert.equal(state.phase, null);
  });

  it("skips without touching rows when a matching_run already exists", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review")]);
    state.actions.push("column_mapping_saved", "validation_run");
    seedFinishedRun(state, 7);

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 7, skipped: true });
    assert.equal(state.claims, 0);
    assert.deepEqual(state.rowWrites, []);
  });

  for (const invalidating of ["column_mapping_saved", "validation_run"]) {
    it(`rematches when ${invalidating} was logged after the last matching_run`, async () => {
      const { state, deps } = createFakeBatch([row("a", "needs_review"), row("done", "resolved")]);
      seedFinishedRun(state, 7);
      state.actions.push(invalidating);

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
    seedFinishedRun(state, 1);

    const result = await runBatchMatchingWithDeps({ force: true }, deps);

    assert.deepEqual(result, { matched_count: 1, skipped: false });
    assert.deepEqual(state.rowWrites, ["open"]);
    assert.equal(state.rows.get("done")?.status, "resolved");
    assert.equal(state.rows.get("skip")?.status, "excluded");
  });

  it("reports could-not-start while another processing phase holds the batch", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review")]);
    state.phase = "materializing_companies";

    await assert.rejects(runBatchMatchingWithDeps({}, deps), (error: unknown) => {
      assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
      assert.equal(error.status, 409);
      assert.equal(error.message, "Matching could not start. Refresh the page and try again.");
      return true;
    });
    assert.equal(state.phase, "materializing_companies");
    assert.deepEqual(state.rowWrites, []);
  });
});

describe("runBatchMatchingWithDeps — rows being replaced or revalidated (L3)", () => {
  const phases: Array<[phase: string, message: string]> = [
    ["parsing", COLUMN_MAPPING_IN_PROGRESS_MESSAGE],
    ["validating", VALIDATION_IN_PROGRESS_MESSAGE],
  ];

  for (const [phase, message] of phases) {
    for (const force of [false, true]) {
      it(`rejects ${force ? "forced" : "normal"} matching during ${phase} instead of skipping on a current matching_run`, async () => {
        const { state, deps } = createFakeBatch([row("a", "needs_review")]);
        state.actions.push("column_mapping_saved", "validation_run");
        seedFinishedRun(state, 7);
        state.phase = phase;
        const otherToken = state.updatedAt;

        await assert.rejects(runBatchMatchingWithDeps({ force }, deps), (error: unknown) => {
          assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
          assert.equal(error.status, 409);
          assert.equal(error.message, message);
          return true;
        });
        assert.equal(state.phase, phase);
        assert.equal(state.updatedAt, otherToken, "the other workflow's claim token must be untouched");
        assert.equal(state.claims, 0);
        assert.deepEqual(state.rowWrites, []);
        assert.equal(state.logs.length, 1, "no matching_run may be logged");
      });
    }
  }

  it("still skips on a current matching_run once the batch is idle", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review")]);
    seedFinishedRun(state, 7);

    assert.deepEqual(await runBatchMatchingWithDeps({}, deps), { matched_count: 7, skipped: true });
    assert.equal(state.claims, 0);
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
    assert.equal(state.logs.at(-1)?.count, 1);
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

  it("does not overwrite a row resolved mid-run during a force rematch", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "auto_ready"), row("b", "auto_ready")]);
    seedFinishedRun(state, 2);
    hooks.beforeMatch = (target) => {
      if (target.id === "a") {
        const b = state.rows.get("b");
        if (b) b.status = "resolved";
      }
    };

    await runBatchMatchingWithDeps({ force: true }, deps);

    assert.equal(state.rows.get("b")?.status, "resolved");
    assert.deepEqual(state.rowWrites, ["a"]);
  });

  it("completes normally when every conditional update affects zero rows", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.beforeMatch = () => {
      const a = state.rows.get("a");
      if (a) a.status = "resolved";
    };

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 0, skipped: false });
    assert.equal(state.logs.at(-1)?.count, 0);
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
    assert.equal(state.logs.length, 1);
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

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 1, skipped: false });
    assert.deepEqual(concurrent, { matched_count: 1, skipped: true });
    assert.equal(state.claims, 1);
    assert.deepEqual(state.rowWrites, ["a"]);
    assert.equal(state.phase, null);
  });

  it("never rematches once the claim is released after completion", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    let concurrent: unknown;
    hooks.afterRelease = async () => {
      hooks.afterRelease = undefined;
      concurrent = await runBatchMatchingWithDeps({}, deps);
    };

    await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(concurrent, { matched_count: 1, skipped: true });
    assert.equal(state.claims, 1);
    assert.equal(state.logs.length, 1);
  });
});

describe("runBatchMatchingWithDeps — force rematch concurrency", () => {
  it("rejects a normal request during a force rematch instead of reporting the old run", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review"), row("b", "needs_review")]);
    seedFinishedRun(state, 9);
    hooks.beforeMatch = async (target) => {
      if (target.id === "a") await assertInProgress409(runBatchMatchingWithDeps({}, deps));
    };

    const forced = await runBatchMatchingWithDeps({ force: true }, deps);

    assert.deepEqual(forced, { matched_count: 2, skipped: false });
    assert.equal(state.claims, 1);
    assert.deepEqual(state.rowWrites, ["a", "b"]);
  });

  it("lets a normal request skip with the new count once the force rematch finishes", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review"), row("b", "needs_review")]);
    seedFinishedRun(state, 9);

    await runBatchMatchingWithDeps({ force: true }, deps);
    const after = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(after, { matched_count: 2, skipped: true });
    assert.equal(state.claims, 1);
  });

  it("rejects a second force request while the first is still matching", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    seedFinishedRun(state, 1);
    hooks.beforeMatch = async () => {
      hooks.beforeMatch = undefined;
      await assertInProgress409(runBatchMatchingWithDeps({ force: true }, deps));
    };

    await runBatchMatchingWithDeps({ force: true }, deps);

    assert.equal(state.claims, 1);
    assert.deepEqual(state.rowWrites, ["a"]);
  });
});

describe("runBatchMatchingWithDeps — heartbeat and stale claim recovery", () => {
  it("renews the claim token every 25 rows and once more before logging", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(`r${i}`, "needs_review"));
    const { state, deps } = createFakeBatch(rows);

    await runBatchMatchingWithDeps({}, deps);

    // After loading the matcher, before rows 26 and 51, and the final fence.
    assert.equal(state.renewals, 4);
    assert.equal(state.rowWrites.length, 60);
  });

  it("never treats an active run as stale, even when the whole run takes far longer than the threshold", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(`r${i}`, "needs_review"));
    const { state, hooks, deps } = createFakeBatch(rows);
    let concurrentAttempts = 0;
    let insideConcurrentRequest = false;
    hooks.beforeMatch = async (target) => {
      if (insideConcurrentRequest) return;
      // Each row takes one minute: the run lasts 40 minutes in total.
      state.nowMs += 60 * 1000;
      if (Number(target.id.slice(1)) % 10 === 9) {
        concurrentAttempts += 1;
        insideConcurrentRequest = true;
        try {
          await assertInProgress409(runBatchMatchingWithDeps({}, deps));
        } finally {
          insideConcurrentRequest = false;
        }
      }
    };

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.equal(concurrentAttempts, 4);
    assert.deepEqual(result, { matched_count: 40, skipped: false });
    assert.equal(state.claims, 1);
    assert.equal(state.logs.length, 1);
    assert.equal(state.logs[0]?.recoveredStaleClaim, false);
    assert.equal(new Set(state.rowWrites).size, 40);
    assert.equal(state.rowWrites.length, 40);
  });

  it("does not recover a claim that is one millisecond younger than the stale threshold", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review")]);
    abandonClaim(state, STALE_MATCHING_CLAIM_MS - 1);

    await assertInProgress409(runBatchMatchingWithDeps({}, deps));

    assert.equal(state.phase, "matching");
    assert.deepEqual(state.rowWrites, []);
  });

  it("recovers a claim left by a killed run and rematches, keeping resolved and excluded rows", async () => {
    const { state, deps } = createFakeBatch([
      row("open", "needs_review"),
      row("partial", "auto_ready"),
      row("done", "resolved"),
      row("skip", "excluded"),
    ]);
    // A current matching_run exists, but a later (e.g. forced) run died holding the claim.
    seedFinishedRun(state, 4);
    abandonClaim(state, STALE_MATCHING_CLAIM_MS);

    const result = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(result, { matched_count: 2, skipped: false });
    assert.deepEqual(state.rowWrites, ["open", "partial"]);
    assert.equal(state.rows.get("done")?.status, "resolved");
    assert.equal(state.rows.get("skip")?.status, "excluded");
    assert.equal(state.logs.at(-1)?.recoveredStaleClaim, true);
    assert.equal(state.phase, null);
  });

  it("lets only one of two requests take over the same stale claim", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review"), row("b", "needs_review")]);
    abandonClaim(state, STALE_MATCHING_CLAIM_MS + 1);

    const results = await Promise.allSettled([
      runBatchMatchingWithDeps({}, deps),
      runBatchMatchingWithDeps({}, deps),
    ]);

    const recovered = results.filter(
      (r) => r.status === "fulfilled" && r.value.skipped === false,
    );
    assert.equal(recovered.length, 1);
    assert.equal(state.logs.length, 1);
    assert.deepEqual(state.rowWrites, ["a", "b"]);
    assert.equal(state.phase, null);
  });

  it("stops a run whose claim was taken over without logging or releasing the new claim", async () => {
    const { state, hooks, deps } = createFakeBatch([
      row("a", "needs_review"),
      row("b", "needs_review"),
      row("c", "needs_review"),
    ]);
    const takeoverToken = "2026-11-18T10:00:00.000Z";
    hooks.beforeMatch = (target) => {
      if (target.id !== "b") return;
      // Another request recovered the claim, and enough time passed for a heartbeat.
      state.updatedAt = takeoverToken;
      state.nowMs += 30 * 1000;
    };

    await assert.rejects(runBatchMatchingWithDeps({}, deps), (error: unknown) => {
      assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
      assert.equal(error.status, 409);
      assert.equal(error.message, MATCHING_CLAIM_LOST_MESSAGE);
      return true;
    });

    assert.equal(state.logs.length, 0);
    assert.equal(state.phase, "matching");
    assert.equal(state.updatedAt, takeoverToken);
    assert.deepEqual(state.rowWrites, ["a", "b"], "row c must not be written after the claim was lost");
  });

  it("releases a finished run's claim at once when matching_run was written but release failed", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.failRelease = true;

    await assert.rejects(runBatchMatchingWithDeps({}, deps), /release failed/);
    assert.equal(state.phase, "matching");
    assert.equal(state.logs.length, 1);

    hooks.failRelease = false;
    state.nowMs += 1000;
    const next = await runBatchMatchingWithDeps({}, deps);

    assert.deepEqual(next, { matched_count: 1, skipped: true });
    assert.equal(state.phase, null);
    assert.equal(state.claims, 1);
    assert.deepEqual(state.rowWrites, ["a"]);
  });

  it("ignores a matching_run token that does not match the active claim", async () => {
    const { state, deps } = createFakeBatch([row("a", "needs_review")]);
    seedFinishedRun(state, 1);
    abandonClaim(state, 60 * 1000);

    await assertInProgress409(runBatchMatchingWithDeps({}, deps));

    assert.equal(state.phase, "matching");
  });
});

describe("runBatchMatchingWithDeps — failures release the claim without logging", () => {
  it("clears processing_phase and writes no matching_run when a row update fails", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review"), row("b", "needs_review")]);
    hooks.failUpdateFor = "b";

    await assert.rejects(runBatchMatchingWithDeps({}, deps), /row update failed/);

    assert.equal(state.phase, null);
    assert.equal(state.logs.length, 0);

    hooks.failUpdateFor = undefined;
    const retry = await runBatchMatchingWithDeps({}, deps);
    assert.equal(retry.skipped, false);
    assert.equal(state.logs.at(-1)?.count, 2);
  });

  it("clears processing_phase and allows a rerun when the action-log write fails", async () => {
    const { state, hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.failLog = true;

    await assert.rejects(runBatchMatchingWithDeps({}, deps), /Failed to write action log/);

    assert.equal(state.phase, null);
    assert.equal(state.logs.length, 0);

    hooks.failLog = false;
    const retry = await runBatchMatchingWithDeps({}, deps);
    assert.equal(retry.skipped, false);
    assert.equal(state.claims, 2);
  });

  it("surfaces the original error when releasing the claim also fails", async () => {
    const { hooks, deps } = createFakeBatch([row("a", "needs_review")]);
    hooks.failUpdateFor = "a";
    hooks.failRelease = true;

    await assert.rejects(runBatchMatchingWithDeps({}, deps), /row update failed/);
  });
});
