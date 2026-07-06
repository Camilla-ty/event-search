import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SUPABASE_IN_FILTER_BATCH_SIZE,
  fetchAllByIdInBatches,
} from "@/src/lib/supabase/fetchInBatches";

describe("fetchAllByIdInBatches", () => {
  it("returns empty array for no ids", async () => {
    assert.deepEqual(await fetchAllByIdInBatches([], async () => ({ data: [], error: null })), []);
  });

  it("dedupes ids and splits into batches of SUPABASE_IN_FILTER_BATCH_SIZE", async () => {
    const ids = Array.from({ length: 250 }, (_, index) =>
      `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    );
    ids.push(ids[0] ?? "");

    const batchSizes: number[] = [];
    const rows = await fetchAllByIdInBatches(ids, async (batchIds) => {
      batchSizes.push(batchIds.length);
      return {
        data: batchIds.map((id) => ({ id })),
        error: null,
      };
    });

    assert.deepEqual(batchSizes, [SUPABASE_IN_FILTER_BATCH_SIZE, SUPABASE_IN_FILTER_BATCH_SIZE, 50]);
    assert.equal(rows.length, 250);
  });

  it("throws when a batch returns an error", async () => {
    await assert.rejects(
      () =>
        fetchAllByIdInBatches(["a"], async () => ({
          data: null,
          error: { message: "TypeError: fetch failed" },
        })),
      /TypeError: fetch failed/,
    );
  });
});
