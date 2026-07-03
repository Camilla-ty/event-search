import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveSeriesLifecycleState,
  validateSeriesLifecycleState,
  validateSeriesLifecycleUpdate,
} from "@/src/lib/validation/eventSeriesLifecycle";

describe("eventSeriesLifecycle", () => {
  it("requires merged_into_series_id when status is merged", () => {
    const errors = validateSeriesLifecycleState({
      lifecycle_status: "merged",
      merged_into_series_id: null,
    });
    assert.match(errors.join("; "), /merged_into_series_id is required/);
  });

  it("clears merged_into_series_id when status is not merged", () => {
    const resolved = resolveSeriesLifecycleState(
      {
        lifecycle_status: "merged",
        merged_into_series_id: "11111111-1111-4111-8111-111111111111",
      },
      { lifecycle_status: "active" },
    );

    assert.equal(resolved.lifecycle_status, "active");
    assert.equal(resolved.merged_into_series_id, null);
  });

  it("rejects self-merge", () => {
    const seriesId = "11111111-1111-4111-8111-111111111111";
    const result = validateSeriesLifecycleUpdate(
      {
        lifecycle_status: null,
        merged_into_series_id: null,
      },
      {
        lifecycle_status: "merged",
        merged_into_series_id: seriesId,
      },
      seriesId,
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.join("; "), /cannot be merged into itself/);
    }
  });

  it("accepts merged status with destination series", () => {
    const result = validateSeriesLifecycleUpdate(
      {
        lifecycle_status: null,
        merged_into_series_id: null,
      },
      {
        lifecycle_status: "merged",
        merged_into_series_id: "22222222-2222-4222-8222-222222222222",
      },
      "11111111-1111-4111-8111-111111111111",
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.patch.lifecycle_status, "merged");
      assert.equal(
        result.patch.merged_into_series_id,
        "22222222-2222-4222-8222-222222222222",
      );
    }
  });
});
