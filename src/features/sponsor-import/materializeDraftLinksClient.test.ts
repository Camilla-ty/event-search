import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MATERIALIZE_DRAFT_LINKS_FAILED_MESSAGE,
  materializeDraftLinksProgressLabel,
  runDraftLinkMaterialization,
  type MaterializeDraftLinksChunkResponse,
} from "./materializeDraftLinksClient";
import type { MaterializeDraftLinksChunkResult } from "./types";

function chunk(
  overrides: Partial<MaterializeDraftLinksChunkResult>,
): MaterializeDraftLinksChunkResponse {
  return {
    ok: true,
    result: {
      examined_count: 0,
      skipped_count: 0,
      links_created: 0,
      links_updated: 0,
      rows_linked: 0,
      total_resolved_rows: 0,
      rows_with_draft_link: 0,
      done: true,
      next_cursor: null,
      ...overrides,
    },
  };
}

describe("materializeDraftLinksProgressLabel", () => {
  it("shows a counted label when totals are known", () => {
    assert.equal(
      materializeDraftLinksProgressLabel({ rowsWithDraftLink: 30, totalResolvedRows: 120 }),
      "Creating draft links… 30/120",
    );
  });

  it("falls back to a generic label when there are no resolved rows yet", () => {
    assert.equal(
      materializeDraftLinksProgressLabel({ rowsWithDraftLink: 0, totalResolvedRows: 0 }),
      "Creating draft links…",
    );
  });
});

describe("runDraftLinkMaterialization", () => {
  it("completes in a single chunk when the server reports done", async () => {
    const calls: Array<number | undefined> = [];
    const result = await runDraftLinkMaterialization((cursor) => {
      calls.push(cursor);
      return Promise.resolve(
        chunk({ examined_count: 5, total_resolved_rows: 5, rows_with_draft_link: 5, done: true }),
      );
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [undefined]);
  });

  it("resumes across chunks by forwarding next_cursor", async () => {
    const calls: Array<number | undefined> = [];
    const responses: MaterializeDraftLinksChunkResponse[] = [
      chunk({
        examined_count: 50,
        rows_linked: 50,
        total_resolved_rows: 120,
        rows_with_draft_link: 50,
        done: false,
        next_cursor: 50,
      }),
      chunk({
        examined_count: 50,
        rows_linked: 50,
        total_resolved_rows: 120,
        rows_with_draft_link: 100,
        done: false,
        next_cursor: 100,
      }),
      chunk({
        examined_count: 20,
        rows_linked: 20,
        total_resolved_rows: 120,
        rows_with_draft_link: 120,
        done: true,
        next_cursor: null,
      }),
    ];

    let index = 0;
    const result = await runDraftLinkMaterialization((cursor) => {
      calls.push(cursor);
      return Promise.resolve(responses[index++]);
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [undefined, 50, 100]);
  });

  it("returns the server error and stops looping on chunk failure", async () => {
    let callCount = 0;
    const result = await runDraftLinkMaterialization(() => {
      callCount += 1;
      return Promise.resolve({ ok: false, error: "boom" });
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "boom");
    }
    assert.equal(callCount, 1);
  });

  it("stops defensively when a non-done chunk makes no progress", async () => {
    const result = await runDraftLinkMaterialization(() =>
      Promise.resolve(
        chunk({ examined_count: 0, total_resolved_rows: 5, rows_with_draft_link: 1, done: false }),
      ),
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, MATERIALIZE_DRAFT_LINKS_FAILED_MESSAGE);
    }
  });
});
