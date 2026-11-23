import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type BatchRow, IMPORT_CHUNK_TAKEOVER_MS, isAbandonedImportChunkClaim } from "./batchGuards";
import { SponsorImportHttpError } from "./errors";
import {
  acquireImportChunkClaimWithDeps,
  completeImportChunkWithDeps,
  IMPORT_CHUNK_CLAIM_LOST_MESSAGE,
  IMPORT_CHUNK_IN_PROGRESS_MESSAGE,
  type AcquireImportChunkClaimDeps,
} from "./sponsorImportAdmin";

type ImportPhase = "materializing_companies" | "importing_to_draft";

const START_MS = Date.parse("2026-11-23T09:00:00.000Z");

/** `timestamp without time zone` text as PostgREST returns it (UTC, no zone suffix). */
function dbTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("Z", "");
}

/**
 * In-memory batch whose writes mirror the chunk routes' Supabase filters: the idle claim needs
 * `status = review` and no phase; continuing needs the same phase and the presented token;
 * takeover needs the same phase and the `updated_at` judged abandoned; release needs the token.
 */
function createFakeImportBatch() {
  const state = {
    nowMs: START_MS,
    status: "review",
    phase: null as string | null,
    updatedAt: dbTimestamp(START_MS - 60 * 60 * 1000) as string | null,
    /** Requests that went on to process rows. */
    processed: [] as string[],
  };

  const issueToken = () => {
    state.nowMs += 1;
    return new Date(state.nowMs).toISOString();
  };

  const read = (): BatchRow => ({
    id: "batch-1",
    event_edition_id: "edition-1",
    status: state.status as BatchRow["status"],
    review_acknowledged_at: null,
    processing_phase: state.phase,
    updated_at: state.updatedAt,
  });

  const deps = (phase: ImportPhase): AcquireImportChunkClaimDeps => ({
    readBatch: async () => read(),
    claimFromIdle: async () => {
      if (state.status !== "review" || state.phase !== null) return null;
      state.phase = phase;
      state.updatedAt = issueToken();
      return state.updatedAt;
    },
    continueClaim: async (token) => {
      if (state.status !== "review" || state.phase !== phase || state.updatedAt !== token) return null;
      state.updatedAt = issueToken();
      return state.updatedAt;
    },
    takeOverClaim: async (abandonedUpdatedAt) => {
      if (state.status !== "review" || state.phase !== phase || state.updatedAt !== abandonedUpdatedAt) {
        return null;
      }
      state.updatedAt = issueToken();
      return state.updatedAt;
    },
    now: () => state.nowMs,
  });

  const release = (phase: ImportPhase) => async (token: string) => {
    if (state.status !== "review" || state.phase !== phase || state.updatedAt !== token) return false;
    state.phase = null;
    state.updatedAt = issueToken();
    return true;
  };

  /** A chunk request: acquire with the batch it read and the token it holds, then process rows. */
  const runChunk = async (
    requestId: string,
    phase: ImportPhase,
    readBatch: BatchRow,
    presentedToken: string | null,
  ) => {
    const claim = await acquireImportChunkClaimWithDeps(phase, readBatch, presentedToken, deps(phase));
    if (claim.acquired) state.processed.push(requestId);
    return claim;
  };

  const token = (claim: Awaited<ReturnType<typeof runChunk>>): string => {
    assert.ok(claim.acquired, "expected the claim to be acquired");
    return claim.token;
  };

  return { state, read, runChunk, token, release };
}

async function assertConflict(promise: Promise<unknown>, message: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SponsorImportHttpError, "expected a SponsorImportHttpError");
    assert.equal(error.status, 409);
    assert.equal(error.message, message);
    return true;
  });
}

describe("isAbandonedImportChunkClaim", () => {
  it("outlasts a full 300s chunk before a claim may be taken over", () => {
    assert.equal(IMPORT_CHUNK_TAKEOVER_MS, 330 * 1000);
    const claim = { processing_phase: "importing_to_draft", updated_at: dbTimestamp(START_MS) };
    assert.equal(isAbandonedImportChunkClaim(claim, START_MS + 300 * 1000), false);
    assert.equal(isAbandonedImportChunkClaim(claim, START_MS + IMPORT_CHUNK_TAKEOVER_MS - 1), false);
    assert.equal(isAbandonedImportChunkClaim(claim, START_MS + IMPORT_CHUNK_TAKEOVER_MS), true);
  });

  it("never applies to other workflows' claims or unparseable timestamps", () => {
    const later = START_MS + 60 * 60 * 1000;
    assert.equal(isAbandonedImportChunkClaim({ processing_phase: "matching", updated_at: dbTimestamp(START_MS) }, later), false);
    assert.equal(isAbandonedImportChunkClaim({ processing_phase: "importing_to_draft", updated_at: "garbage" }, later), false);
  });
});

for (const phase of ["materializing_companies", "importing_to_draft"] as const) {
  describe(`acquireImportChunkClaimWithDeps — ${phase}`, () => {
    it("the first chunk claims the idle batch and gets a token", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();

      const claimed = token(await runChunk("A", phase, read(), null));

      assert.equal(state.phase, phase);
      assert.equal(state.updatedAt, claimed);
      assert.deepEqual(state.processed, ["A"]);
    });

    it("the owner continues with its token, and each chunk gets a fresh token", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      const first = token(await runChunk("A1", phase, read(), null));

      const second = token(await runChunk("A2", phase, read(), first));

      assert.notEqual(second, first);
      assert.equal(state.updatedAt, second);
      assert.deepEqual(state.processed, ["A1", "A2"]);
    });

    it("a second request without the token is rejected while the owner's chunk may be running", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      const owner = token(await runChunk("A", phase, read(), null));
      // Exactly the case the earlier refresh check allowed: B reads after A's claim and refresh.
      state.nowMs += IMPORT_CHUNK_TAKEOVER_MS - 1000;

      await assertConflict(runChunk("B", phase, read(), null), IMPORT_CHUNK_IN_PROGRESS_MESSAGE);

      assert.equal(state.updatedAt, owner, "the owner's claim is untouched");
      assert.deepEqual(state.processed, ["A"]);
    });

    it("of two concurrent requests that read an idle batch, only one processes rows", async () => {
      const { state, read, runChunk } = createFakeImportBatch();
      const snapshot = read();

      const results = await Promise.allSettled([
        runChunk("A", phase, snapshot, null),
        runChunk("B", phase, snapshot, null),
      ]);

      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(rejected?.status === "rejected");
      assert.equal((rejected.reason as SponsorImportHttpError).message, IMPORT_CHUNK_IN_PROGRESS_MESSAGE);
      assert.equal(state.processed.length, 1);
    });

    it("of two concurrent requests presenting the same token, only one continues", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      const owner = token(await runChunk("first", phase, read(), null));
      const snapshot = read();

      const results = await Promise.allSettled([
        runChunk("A", phase, snapshot, owner),
        runChunk("B", phase, snapshot, owner),
      ]);

      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(rejected?.status === "rejected");
      assert.equal((rejected.reason as SponsorImportHttpError).message, IMPORT_CHUNK_CLAIM_LOST_MESSAGE);
      assert.equal(state.processed.length, 2);
    });

    it("a retry with an outdated token is rejected while a chunk may still be running", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      const first = token(await runChunk("A1", phase, read(), null));
      // A2's response is lost: the server refreshed the claim, the client still holds `first`.
      token(await runChunk("A2", phase, read(), first));

      await assertConflict(runChunk("retry", phase, read(), first), IMPORT_CHUNK_CLAIM_LOST_MESSAGE);

      assert.deepEqual(state.processed, ["A1", "A2"]);
    });

    it("a retry after a failed request takes over once no chunk can still be running", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      const first = token(await runChunk("A1", phase, read(), null));
      token(await runChunk("A2", phase, read(), first));
      state.nowMs += IMPORT_CHUNK_TAKEOVER_MS;

      const retried = token(await runChunk("retry", phase, read(), first));

      assert.equal(state.phase, phase);
      assert.equal(state.updatedAt, retried);
      assert.deepEqual(state.processed, ["A1", "A2", "retry"]);
    });

    it("a request without a token takes over an abandoned claim, e.g. after a page reload", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      token(await runChunk("A", phase, read(), null));
      state.nowMs += IMPORT_CHUNK_TAKEOVER_MS;

      token(await runChunk("B", phase, read(), null));

      assert.deepEqual(state.processed, ["A", "B"]);
    });

    it("of two requests taking over the same abandoned claim, only one succeeds", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      token(await runChunk("A", phase, read(), null));
      state.nowMs += IMPORT_CHUNK_TAKEOVER_MS;
      const snapshot = read();

      token(await runChunk("B", phase, snapshot, null));
      await assertConflict(runChunk("C", phase, snapshot, null), IMPORT_CHUNK_IN_PROGRESS_MESSAGE);

      assert.deepEqual(state.processed, ["A", "B"]);
    });

    it("the previous owner cannot continue after its claim was taken over", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      const owner = token(await runChunk("A1", phase, read(), null));
      state.nowMs += IMPORT_CHUNK_TAKEOVER_MS;
      token(await runChunk("B", phase, read(), null));

      await assertConflict(runChunk("A2", phase, read(), owner), IMPORT_CHUNK_CLAIM_LOST_MESSAGE);

      assert.deepEqual(state.processed, ["A1", "B"]);
    });

    it("a token is useless once the batch has been finalized", async () => {
      const { state, read, runChunk, token } = createFakeImportBatch();
      const owner = token(await runChunk("A1", phase, read(), null));
      state.status = "draft";

      await assertConflict(runChunk("A2", phase, read(), owner), IMPORT_CHUNK_CLAIM_LOST_MESSAGE);

      assert.equal(state.status, "draft");
      assert.deepEqual(state.processed, ["A1"]);
    });

    it("another workflow's claim is returned for the caller's response and nothing is processed", async () => {
      const { state, read, runChunk } = createFakeImportBatch();
      const idleSnapshot = read();
      state.phase = "validating";
      const validationToken = state.updatedAt;
      state.nowMs += IMPORT_CHUNK_TAKEOVER_MS * 10;

      const claim = await runChunk("A", phase, idleSnapshot, null);

      assert.equal(claim.acquired, false);
      assert.equal(state.phase, "validating");
      assert.equal(state.updatedAt, validationToken, "no takeover of another workflow's claim");
      assert.deepEqual(state.processed, []);
    });
  });
}

describe("acquireImportChunkClaimWithDeps — between import steps", () => {
  it("a draft-link chunk cannot join a company materialization claim, even with its token", async () => {
    const { state, read, runChunk, token } = createFakeImportBatch();
    const companiesToken = token(await runChunk("companies", "materializing_companies", read(), null));

    const claim = await runChunk("links", "importing_to_draft", read(), companiesToken);

    assert.equal(claim.acquired, false);
    assert.equal(state.phase, "materializing_companies");
    assert.deepEqual(state.processed, ["companies"]);
  });

  it("a company chunk cannot join a draft-link claim", async () => {
    const { state, read, runChunk, token } = createFakeImportBatch();
    token(await runChunk("links", "importing_to_draft", read(), null));

    const claim = await runChunk("companies", "materializing_companies", read(), null);

    assert.equal(claim.acquired, false);
    assert.equal(state.phase, "importing_to_draft");
  });
});

describe("completeImportChunkWithDeps — token-filtered completion", () => {
  for (const phase of ["materializing_companies", "importing_to_draft"] as const) {
    it(`an unfinished ${phase} chunk keeps the claim and returns its token`, async () => {
      const { state, read, runChunk, token, release } = createFakeImportBatch();
      const owner = token(await runChunk("A", phase, read(), null));

      const result = await completeImportChunkWithDeps(phase, owner, { done: false }, release(phase));

      assert.deepEqual(result, { done: false, claim_token: owner });
      assert.equal(state.phase, phase);
    });

    it(`a finished ${phase} chunk releases its own claim`, async () => {
      const { state, read, runChunk, token, release } = createFakeImportBatch();
      const owner = token(await runChunk("A", phase, read(), null));

      const result = await completeImportChunkWithDeps(phase, owner, { done: true }, release(phase));

      assert.deepEqual(result, { done: true, claim_token: null });
      assert.equal(state.phase, null);
    });

    it(`a finished ${phase} chunk that lost its claim leaves the new owner's claim alone`, async () => {
      const { state, read, runChunk, token, release } = createFakeImportBatch();
      const lostToken = token(await runChunk("A", phase, read(), null));
      state.nowMs += IMPORT_CHUNK_TAKEOVER_MS;
      const newOwner = token(await runChunk("B", phase, read(), null));

      await assertConflict(
        completeImportChunkWithDeps(phase, lostToken, { done: true }, release(phase)),
        IMPORT_CHUNK_CLAIM_LOST_MESSAGE,
      );

      assert.equal(state.phase, phase);
      assert.equal(state.updatedAt, newOwner);
    });
  }
});
