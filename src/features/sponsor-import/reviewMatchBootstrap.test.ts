import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bootstrapReviewMatching } from "./reviewMatchBootstrap";

describe("bootstrapReviewMatching", () => {
  it("loads rows after a successful match without checking the batch phase", async () => {
    const calls: string[] = [];
    const result = await bootstrapReviewMatching({
      runMatching: async () => {
        calls.push("match");
        return { ok: true, matched_count: 10 };
      },
      loadRows: async () => {
        calls.push("rows");
        return true;
      },
      readProcessingPhase: async () => {
        calls.push("phase");
        return null;
      },
    });

    assert.deepEqual(calls, ["match", "rows"]);
    assert.deepEqual(result, { matchError: null, rowsLoaded: true, matchInProgress: false });
  });

  it("locks review when /match returns 409 because matching is still running", async () => {
    const result = await bootstrapReviewMatching({
      runMatching: async () => ({
        ok: false,
        error: "Matching is already in progress.",
        details: { processing_phase: "matching" },
      }),
      loadRows: async () => true,
      readProcessingPhase: async () => "matching",
    });

    assert.deepEqual(result, {
      matchError: "Matching is already in progress.",
      rowsLoaded: true,
      matchInProgress: true,
    });
  });

  it("locks review after a client timeout while the server is still matching", async () => {
    const result = await bootstrapReviewMatching({
      runMatching: async () => ({ ok: false, error: "Timed out after 280 seconds. Retry." }),
      loadRows: async () => true,
      readProcessingPhase: async () => "matching",
    });

    assert.equal(result.matchInProgress, true);
    assert.equal(result.rowsLoaded, true);
  });

  it("does not lock review when matching failed and the claim was released", async () => {
    const result = await bootstrapReviewMatching({
      runMatching: async () => ({ ok: false, error: "row update failed" }),
      loadRows: async () => true,
      readProcessingPhase: async () => null,
    });

    assert.deepEqual(result, {
      matchError: "row update failed",
      rowsLoaded: true,
      matchInProgress: false,
    });
  });

  it("stays locked when the batch phase cannot be read after a failed match", async () => {
    const result = await bootstrapReviewMatching({
      runMatching: async () => ({ ok: false, error: "Network error. Retry." }),
      loadRows: async () => true,
      readProcessingPhase: async () => {
        throw new Error("batch fetch failed");
      },
    });

    assert.equal(result.matchInProgress, true);
  });

  it("reports rowsLoaded=false instead of throwing when the row request throws", async () => {
    const result = await bootstrapReviewMatching({
      runMatching: async () => ({ ok: true, matched_count: 1 }),
      loadRows: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
      readProcessingPhase: async () => null,
    });

    assert.deepEqual(result, { matchError: null, rowsLoaded: false, matchInProgress: false });
  });
});
